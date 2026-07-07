import jwt from "jsonwebtoken";
import { CookieOptions } from "express";
import { SWLogger } from "simple-wire";
import { Config } from "@/setup/config";

const SESSION_COOKIE_NAME = "portifo_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

interface GoogleTokenInfo {
  aud: string;
  sub: string;
  exp: string;
  scope: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  email_verified: boolean;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

export interface SessionPayload {
  userId: string;
}

export class AuthService {
  constructor(
    private readonly logger: SWLogger,
    private readonly cfg: Config,
  ) {}

  get cookieName(): string {
    return SESSION_COOKIE_NAME;
  }

  get cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: this.cfg.NODE_ENV === "production",
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: "/",
    };
  }

  async verifyGoogleAccessToken(accessToken: string): Promise<GoogleProfile> {
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!tokenInfoRes.ok) {
      throw new Error("Invalid Google access token");
    }
    const tokenInfo = (await tokenInfoRes.json()) as GoogleTokenInfo;
    if (tokenInfo.aud !== this.cfg.GOOGLE_CLIENT_ID) {
      this.logger.error("Google access token audience mismatch");
      throw new Error("Google access token audience mismatch");
    }

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoRes.ok) {
      throw new Error("Failed to fetch Google user info");
    }
    const userInfo = (await userInfoRes.json()) as GoogleUserInfo;

    return { googleId: userInfo.sub, email: userInfo.email, name: userInfo.name };
  }

  signSession(userId: string): string {
    return jwt.sign({ sub: userId }, this.cfg.SESSION_SECRET, {
      expiresIn: SESSION_TTL_SECONDS,
    });
  }

  verifySession(token: string): SessionPayload | null {
    try {
      const decoded = jwt.verify(token, this.cfg.SESSION_SECRET);
      if (typeof decoded === "string" || !decoded.sub) return null;
      return { userId: decoded.sub as string };
    } catch {
      return null;
    }
  }
}
