import { Request, Response, Router } from "express";
import { SWController, SWLogger } from "simple-wire";
import { AuthService } from "@/domain/auth/auth.service";
import { IdentityService } from "@/domain/identity/identity.service";
import { MarketService, HistoryRange, Quote } from "@/domain/market/market.service";
import { LiveQuoteService } from "@/domain/market/live-quote.service";

const HISTORY_RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y", "5Y", "All"] as const;

function isHistoryRange(value: unknown): value is HistoryRange {
  return HISTORY_RANGES.includes(value as HistoryRange);
}

// `extended=1`: a 1D with the day's pre-market and after-hours bars too.
function wantsExtended(raw: unknown): boolean {
  return raw === "1";
}

// What one stream may watch. A symbol is a Yahoo ticker, exchange suffix
// included (SHOP.TO, EURUSD=X), never this long.
const MAX_STREAM_SYMBOLS = 500;
const MAX_SYMBOL_LENGTH = 24;
// The watchlist's lines are a chart request each.
const MAX_SPARK_SYMBOLS = 100;

// A stream sends what moved at most this often: a busy listing trades several
// times a second, and the app needs only its latest price.
const STREAM_FLUSH_MS = 1_000;
// A comment line every so often, so nothing between here and the app takes
// a quiet market for a dead connection.
const STREAM_KEEPALIVE_MS = 25_000;

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
    private readonly liveQuotes: LiveQuoteService,
  ) {}

  public register(router: Router): void {
    router.get("/market/quotes", this.getQuotes);
    router.get("/market/stream", this.streamQuotes);
    router.get("/market/fx", this.getFx);
    router.get("/market/history", this.getHistory);
    router.get("/market/sparks", this.getSparks);
    router.get("/market/sma", this.getSma);
    router.get("/market/earnings", this.getEarnings);
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

  // Server-sent events: each quote as soon as it's held, then again whenever
  // it moves, as `event: quotes` with a JSON list of Quotes. The symbols are
  // fixed for the stream's life; to watch others, open another.
  private streamQuotes = async (req: Request, res: Response): Promise<void> => {
    if (!(await this.authenticate(req))) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const symbols = [...new Set(parseSymbols(req.query.symbols))];
    if (symbols.length > MAX_STREAM_SYMBOLS || symbols.some((s) => s.length > MAX_SYMBOL_LENGTH)) {
      res.status(400).json({ error: "Invalid symbols" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx would otherwise hold the events back to fill its buffer.
      "X-Accel-Buffering": "no",
    });
    // How long the browser waits before reconnecting a stream that dropped.
    res.write("retry: 3000\n\n");

    const pending = new Map<string, Quote>();
    let flushTimer: NodeJS.Timeout | null = null;
    let lastFlush = 0;
    const flush = () => {
      flushTimer = null;
      lastFlush = Date.now();
      if (pending.size === 0) return;
      res.write(`event: quotes\ndata: ${JSON.stringify([...pending.values()])}\n\n`);
      pending.clear();
    };
    const watch = this.liveQuotes.watch(symbols, (quote) => {
      pending.set(quote.symbol, quote);
      if (!flushTimer) flushTimer = setTimeout(flush, Math.max(0, lastFlush + STREAM_FLUSH_MS - Date.now()));
    });
    const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), STREAM_KEEPALIVE_MS);

    res.on("close", () => {
      watch.close();
      clearInterval(keepAlive);
      if (flushTimer) clearTimeout(flushTimer);
    });
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
      res.json(await this.marketService.getHistory(symbol, range, wantsExtended(req.query.extended)));
    } catch (err) {
      this.logger.error("MarketController.getHistory failed");
      res.status(502).json({ error: "Failed to fetch history" });
    }
  };

  // The watchlist's lines, by symbol; `extended=1` adds the day's pre-market
  // and after hours.
  private getSparks = async (req: Request, res: Response): Promise<void> => {
    if (!(await this.authenticate(req))) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const symbols = [...new Set(parseSymbols(req.query.symbols))];
    if (symbols.length > MAX_SPARK_SYMBOLS || symbols.some((s) => s.length > MAX_SYMBOL_LENGTH)) {
      res.status(400).json({ error: "Invalid symbols" });
      return;
    }

    try {
      res.json(await this.marketService.getSparks(symbols, wantsExtended(req.query.extended)));
    } catch (err) {
      this.logger.error("MarketController.getSparks failed");
      res.status(502).json({ error: "Failed to fetch charts" });
    }
  };

  private getSma = async (req: Request, res: Response): Promise<void> => {
    if (!(await this.authenticate(req))) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const symbol = String(req.query.symbol ?? "").toUpperCase();
    const range = req.query.range;
    const window = Number(req.query.window ?? 200);
    const validWindow = Number.isInteger(window) && window >= 2 && window <= 250;
    if (!symbol || !isHistoryRange(range) || !validWindow) {
      res.status(400).json({ error: "Invalid indicator query" });
      return;
    }

    try {
      res.json(await this.marketService.getSma(symbol, range, window, wantsExtended(req.query.extended)));
    } catch (err) {
      this.logger.error("MarketController.getSma failed");
      res.status(502).json({ error: "Failed to fetch indicator" });
    }
  };

  private getEarnings = async (req: Request, res: Response): Promise<void> => {
    if (!(await this.authenticate(req))) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const symbol = String(req.query.symbol ?? "").toUpperCase();
    if (!symbol) {
      res.status(400).json({ error: "Invalid earnings query" });
      return;
    }

    try {
      res.json(await this.marketService.getEarnings(symbol));
    } catch (err) {
      this.logger.error("MarketController.getEarnings failed");
      res.status(502).json({ error: "Failed to fetch earnings" });
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
