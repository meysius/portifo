import { Request, Response, Router } from "express";
import { SWController, SWLogger } from "simple-wire";
import { AuthService } from "@/domain/auth/auth.service";
import { IdentityService } from "@/domain/identity/identity.service";
import { AlertInput, AlertService } from "@/domain/alert/alert.service";
import { PriceAlertsSelect } from "@/domain/alert/alert.schema";
import { UsersSelect } from "@/domain/identity/identity.schema";
import { parseSymbol } from "@/controllers/watchlist.controller";

// Postgres errors on invalid uuid input rather than returning no rows.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The column holds numeric(20, 8): twelve digits before the point.
const MAX_PRICE = 1e12;

function parseAlertInput(body: unknown): AlertInput | null {
  const { direction, price } = (body ?? {}) as Record<string, unknown>;
  if (direction !== "below" && direction !== "above") return null;
  if (typeof price !== "number" || !(price > 0) || price >= MAX_PRICE) return null;
  return { direction, price };
}

function toAlertDto(alert: PriceAlertsSelect) {
  return {
    id: alert.id,
    symbol: alert.symbol,
    direction: alert.direction,
    price: Number(alert.price),
    triggeredAt: alert.triggeredAt?.toISOString() ?? null,
    triggeredPrice: alert.triggeredPrice == null ? null : Number(alert.triggeredPrice),
  };
}

export class AlertController implements SWController {
  constructor(
    private readonly logger: SWLogger,
    private readonly authService: AuthService,
    private readonly identityService: IdentityService,
    private readonly alertService: AlertService,
  ) {}

  public register(router: Router): void {
    router.get("/alerts", this.list);
    router.post("/alerts", this.create);
    router.patch("/alerts/:id", this.update);
    router.delete("/alerts/:id", this.remove);
  }

  private authenticate = async (req: Request): Promise<UsersSelect | null> => {
    const token = req.cookies?.[this.authService.cookieName];
    const session = token ? this.authService.verifySession(token) : null;
    if (!session) return null;
    const user = await this.identityService.getUserById(session.userId);
    return user ?? null;
  };

  private list = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const alerts = await this.alertService.list(user.id);
      res.json(alerts.map(toAlertDto));
    } catch (err) {
      this.logger.error("AlertController.list failed");
      res.status(500).json({ error: "Failed to load alerts" });
    }
  };

  private create = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const symbol = parseSymbol(req.body?.symbol);
    const input = parseAlertInput(req.body);
    if (!symbol || !input) {
      res.status(400).json({ error: "Invalid alert" });
      return;
    }

    try {
      const alert = await this.alertService.create(user.id, symbol, input);
      res.status(201).json(toAlertDto(alert));
    } catch (err) {
      this.logger.error("AlertController.create failed");
      res.status(500).json({ error: "Failed to create alert" });
    }
  };

  private update = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const id = String(req.params.id);
    const input = parseAlertInput(req.body);
    if (!UUID_RE.test(id) || !input) {
      res.status(400).json({ error: "Invalid alert" });
      return;
    }

    try {
      const alert = await this.alertService.update(user.id, id, input);
      if (!alert) {
        res.status(404).json({ error: "Alert not found" });
        return;
      }
      res.json(toAlertDto(alert));
    } catch (err) {
      this.logger.error("AlertController.update failed");
      res.status(500).json({ error: "Failed to update alert" });
    }
  };

  private remove = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const id = String(req.params.id);
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "Invalid alert" });
      return;
    }

    try {
      const removed = await this.alertService.remove(user.id, id);
      if (!removed) {
        res.status(404).json({ error: "Alert not found" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      this.logger.error("AlertController.remove failed");
      res.status(500).json({ error: "Failed to delete alert" });
    }
  };
}
