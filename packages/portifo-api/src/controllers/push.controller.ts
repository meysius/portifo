import { Request, Response, Router } from "express";
import { SWController, SWLogger } from "simple-wire";
import { AuthService } from "@/domain/auth/auth.service";
import { IdentityService } from "@/domain/identity/identity.service";
import { PushService } from "@/domain/push/push.service";
import { UsersSelect } from "@/domain/identity/identity.schema";
import { Config } from "@/setup/config";

function isPushSubscription(value: unknown): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.endpoint !== "string" || !v.endpoint) return false;
  if (typeof v.keys !== "object" || v.keys === null) return false;
  const keys = v.keys as Record<string, unknown>;
  return typeof keys.p256dh === "string" && typeof keys.auth === "string";
}

export class PushController implements SWController {
  constructor(
    private readonly logger: SWLogger,
    private readonly cfg: Config,
    private readonly authService: AuthService,
    private readonly identityService: IdentityService,
    private readonly pushService: PushService,
  ) {}

  public register(router: Router): void {
    router.get("/push/vapid-public-key", this.getVapidPublicKey);
    router.post("/push/subscribe", this.subscribe);
    router.post("/push/test", this.sendTest);
  }

  private authenticate = async (req: Request): Promise<UsersSelect | null> => {
    const token = req.cookies?.[this.authService.cookieName];
    const session = token ? this.authService.verifySession(token) : null;
    if (!session) return null;
    const user = await this.identityService.getUserById(session.userId);
    return user ?? null;
  };

  private getVapidPublicKey = async (_req: Request, res: Response): Promise<void> => {
    res.json({ publicKey: this.cfg.VAPID_PUBLIC_KEY });
  };

  private subscribe = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!isPushSubscription(req.body)) {
      res.status(400).json({ error: "Invalid subscription payload" });
      return;
    }

    await this.pushService.subscribe(user.id, req.body);
    res.status(204).end();
  };

  private sendTest = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const result = await this.pushService.sendToUser(user.id, {
        title: "Portifo",
        body: "This is a test notification from Portifo.",
      });
      res.json(result);
    } catch (err) {
      this.logger.error("PushController.sendTest failed");
      res.status(502).json({ error: "Failed to send notification" });
    }
  };
}
