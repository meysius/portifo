import { Request, Response, Router } from "express";
import { SWController, SWLogger } from "simple-wire";
import { AuthService } from "@/domain/auth/auth.service";
import { IdentityService } from "@/domain/identity/identity.service";
import { MarketService, HistoryRange } from "@/domain/market/market.service";

const HISTORY_RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y", "5Y", "All"] as const;

function isHistoryRange(value: unknown): value is HistoryRange {
  return HISTORY_RANGES.includes(value as HistoryRange);
}

function parseSymbols(raw: unknown): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export class MarketController implements SWController {
  constructor(
    private readonly logger: SWLogger,
    private readonly authService: AuthService,
    private readonly identityService: IdentityService,
    private readonly marketService: MarketService,
  ) {}

  public register(router: Router): void {
    router.get("/market/quotes", this.getQuotes);
    router.get("/market/fx", this.getFx);
    router.get("/market/history", this.getHistory);
    router.get("/market/search", this.searchSymbols);
  }

  private authenticate = async (req: Request): Promise<boolean> => {
    const token = req.cookies?.[this.authService.cookieName];
    const session = token ? this.authService.verifySession(token) : null;
    if (!session) return false;
    const user = await this.identityService.getUserById(session.userId);
    return !!user;
  };

  private getQuotes = async (req: Request, res: Response): Promise<void> => {
    if (!(await this.authenticate(req))) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const symbols = parseSymbols(req.query.symbols);
    try {
      res.json(await this.marketService.getQuotes(symbols));
    } catch (err) {
      this.logger.error("MarketController.getQuotes failed");
      res.status(502).json({ error: "Failed to fetch quotes" });
    }
  };

  private getFx = async (req: Request, res: Response): Promise<void> => {
    if (!(await this.authenticate(req))) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const base = String(req.query.base ?? "USD").toUpperCase();
    const symbols = parseSymbols(req.query.symbols);
    try {
      const rates = await this.marketService.getFxRates(base, symbols);
      res.json({ base, rates: { ...rates, [base]: 1 }, asOf: new Date().toISOString() });
    } catch (err) {
      this.logger.error("MarketController.getFx failed");
      res.status(502).json({ error: "Failed to fetch fx rates" });
    }
  };

  private getHistory = async (req: Request, res: Response): Promise<void> => {
    if (!(await this.authenticate(req))) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const symbol = String(req.query.symbol ?? "").toUpperCase();
    const range = req.query.range;
    if (!symbol || !isHistoryRange(range)) {
      res.status(400).json({ error: "Invalid history query" });
      return;
    }

    try {
      res.json(await this.marketService.getHistory(symbol, range));
    } catch (err) {
      this.logger.error("MarketController.getHistory failed");
      res.status(502).json({ error: "Failed to fetch history" });
    }
  };

  private searchSymbols = async (req: Request, res: Response): Promise<void> => {
    if (!(await this.authenticate(req))) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const query = String(req.query.q ?? "").trim();
    if (!query) {
      res.json([]);
      return;
    }

    try {
      res.json(await this.marketService.searchSymbols(query));
    } catch (err) {
      this.logger.error("MarketController.searchSymbols failed");
      res.status(502).json({ error: "Failed to search symbols" });
    }
  };
}
