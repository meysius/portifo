import { Request, Response, Router } from "express";
import { SWController, SWLogger } from "simple-wire";
import { AuthService } from "@/domain/auth/auth.service";
import { IdentityService } from "@/domain/identity/identity.service";

export class AuthController implements SWController {
  constructor(
    private readonly logger: SWLogger,
    private readonly authService: AuthService,
    private readonly identityService: IdentityService,
  ) {}

  public register(router: Router): void {
    router.post("/auth/google", this.loginWithGoogle);
    router.get("/auth/me", this.me);
    router.post("/auth/logout", this.logout);
  }

  private loginWithGoogle = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("AuthController.loginWithGoogle called");
    const accessToken = req.body?.access_token;
    if (typeof accessToken !== "string" || !accessToken) {
      res.status(400).json({ error: "access_token is required" });
      return;
    }

    let profile;
    try {
      profile = await this.authService.verifyGoogleAccessToken(accessToken);
    } catch {
      res.status(401).json({ error: "Invalid Google access token" });
      return;
    }

    let user = await this.identityService.findUserByGoogleId(profile.googleId);
    if (!user) {
      // A user row can already exist under this email without the real Google
      // ID (e.g. pre-seeded via a script) — adopt it instead of trying to
      // create a second row, which would violate the unique email constraint.
      const existingByEmail = await this.identityService.findUserByEmail(profile.email);
      user = existingByEmail
        ? await this.identityService.updateUserGoogleId(existingByEmail.id, profile.googleId)
        : await this.identityService.createUserWithDefaultPortfolio({
            googleId: profile.googleId,
            email: profile.email,
            name: profile.name,
          });
    }

    const session = this.authService.signSession(user.id);
    res.cookie(this.authService.cookieName, session, this.authService.cookieOptions);
    res.json({ id: user.id, email: user.email, name: user.name });
  };

  private me = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("AuthController.me called");
    const token = req.cookies?.[this.authService.cookieName];
    const session = token ? this.authService.verifySession(token) : null;
    if (!session) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const user = await this.identityService.getUserById(session.userId);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json({ id: user.id, email: user.email, name: user.name });
  };

  private logout = async (_req: Request, res: Response): Promise<void> => {
    this.logger.info("AuthController.logout called");
    res.clearCookie(this.authService.cookieName, { path: "/" });
    res.status(204).send();
  };
}
