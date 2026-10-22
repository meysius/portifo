import { Request, Response, Router } from "express";
import { SWController, SWLogger } from "simple-wire";
import { AuthService } from "@/domain/auth/auth.service";
import { IdentityService } from "@/domain/identity/identity.service";
import { WatchlistService } from "@/domain/watchlist/watchlist.service";
import { WatchlistItemsSelect } from "@/domain/watchlist/watchlist.schema";
import { UsersSelect } from "@/domain/identity/identity.schema";

// Yahoo symbols: letters and digits, plus the punctuation its tickers use for
// share classes (BRK-B), exchanges (SHOP.TO), indices (^GSPC) and pairs (EURUSD=X).
const SYMBOL_RE = /^[A-Z0-9.\-=^]{1,20}$/;

function parseSymbol(raw: unknown): string | null {
  const symbol = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return SYMBOL_RE.test(symbol) ? symbol : null;
}

function toWatchlistItemDto(item: WatchlistItemsSelect) {
  return { symbol: item.symbol, addedAt: item.createdAt.toISOString() };
}

export class WatchlistController implements SWController {
  constructor(
    private readonly logger: SWLogger,
    private readonly authService: AuthService,
    private readonly identityService: IdentityService,
    private readonly watchlistService: WatchlistService,
  ) {}

  public register(router: Router): void {
    router.get("/watchlist", this.list);
    router.post("/watchlist", this.add);
    router.delete("/watchlist/:symbol", this.remove);
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
      const items = await this.watchlistService.list(user.id);
      res.json(items.map(toWatchlistItemDto));
    } catch (err) {
      this.logger.error("WatchlistController.list failed");
      res.status(500).json({ error: "Failed to load watchlist" });
    }
  };

  private add = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const symbol = parseSymbol(req.body?.symbol);
    if (!symbol) {
      res.status(400).json({ error: "Invalid symbol" });
      return;
    }

    try {
      const item = await this.watchlistService.add(user.id, symbol);
      res.status(201).json(toWatchlistItemDto(item));
    } catch (err) {
      this.logger.error("WatchlistController.add failed");
      res.status(500).json({ error: "Failed to add to watchlist" });
    }
  };

  private remove = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const symbol = parseSymbol(req.params.symbol);
    if (!symbol) {
      res.status(400).json({ error: "Invalid symbol" });
      return;
    }

    try {
      await this.watchlistService.remove(user.id, symbol);
      res.status(204).end();
    } catch (err) {
      this.logger.error("WatchlistController.remove failed");
      res.status(500).json({ error: "Failed to remove from watchlist" });
    }
  };
}
