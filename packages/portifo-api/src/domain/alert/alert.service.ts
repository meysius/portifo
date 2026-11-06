import { SWLogger } from "simple-wire";
import { Quote } from "@/domain/market/market.service";
import { LiveQuoteService, QuoteWatch } from "@/domain/market/live-quote.service";
import { PushService } from "@/domain/push/push.service";
import { AlertRepo } from "./alert.repo";
import { AlertDirection, AlertMode, PriceAlertsSelect, PriceSide } from "./alert.schema";

export type AlertInput = { mode: AlertMode; direction: AlertDirection; price: number };

// To the last decimal that means something: an FX rate or a penny stock isn't
// a two-decimal price, and a rule's target should read back as it was typed.
function fmtPrice(n: number, currency: string): string {
  try {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: n < 1 ? 8 : 4,
    });
  } catch {
    return `${n} ${currency}`;
  }
}

// A traded price, which can run to more decimals than anyone quotes: cents,
// unless it's small enough for the cents to be the whole story.
const fmtTraded = (n: number, currency: string) => fmtPrice(n >= 10 ? Math.round(n * 100) / 100 : n, currency);

const SESSION_LABEL = { pre: "Pre-market", post: "After hours", overnight: "Overnight" } as const;

// The least time between two checks of one symbol's rules on its streamed
// price. A busy listing trades several times a second, and each check is a
// few queries.
const LIVE_CHECK_EVERY_MS = 3_000;

// How long a symbol's rules wait once it's on the live feed. The feed's
// first quote is Yahoo's polled one, whose after-hours price stops at 8pm
// ET; overnight, the stream's first trade follows a few seconds later and
// can sit the other side of a rule's level. Judging the first would set a
// rule off one way and the second back the other, on every restart.
const SETTLE_MS = 30_000;

type LiveCheck = { quote: Quote; timer: NodeJS.Timeout | null; lastRun: number };

export class AlertService {
  private live: QuoteWatch | null = null;
  private readonly liveChecks = new Map<string, LiveCheck>();
  // When each running rule's symbol went on the live feed.
  private readonly watchedSince = new Map<string, number>();

  constructor(
    private readonly logger: SWLogger,
    private readonly alertRepo: AlertRepo,
    private readonly liveQuotes: LiveQuoteService,
    private readonly pushService: PushService,
  ) {}

  async list(userId: string): Promise<PriceAlertsSelect[]> {
    return this.alertRepo.listByUser(userId);
  }

  async create(userId: string, symbol: string, input: AlertInput): Promise<PriceAlertsSelect> {
    return this.alertRepo.create({
      userId,
      symbol,
      mode: input.mode,
      direction: input.direction,
      price: String(input.price),
    });
  }

  async update(userId: string, id: string, input: AlertInput): Promise<PriceAlertsSelect | null> {
    return this.alertRepo.update(userId, id, {
      mode: input.mode,
      direction: input.direction,
      price: String(input.price),
    });
  }

  async remove(userId: string, id: string): Promise<boolean> {
    return this.alertRepo.remove(userId, id);
  }

  // Keeps the running rules' symbols on the live feed, whose every move is
  // checked within seconds (onLiveQuote), then checks each one's quote as it
  // stands, as a backstop for a live check that failed. Both judge the same
  // quote: when this read Yahoo's quote endpoint, its after-hours close and
  // the feed's overnight price sat on either side of a live rule's level, and
  // each check undid the other every minute. A symbol the feed hasn't polled
  // yet is checked by onLiveQuote once it has, and a new one only after
  // SETTLE_MS. Safe to overlap with itself, because firing is atomic.
  async checkAlerts(): Promise<void> {
    const symbols = await this.alertRepo.listRunningSymbols();
    const now = Date.now();
    for (const symbol of this.watchedSince.keys()) {
      if (!symbols.includes(symbol)) this.watchedSince.delete(symbol);
    }
    for (const symbol of symbols) {
      if (!this.watchedSince.has(symbol)) this.watchedSince.set(symbol, now);
    }
    if (this.live) this.live.set(symbols);
    else this.live = this.liveQuotes.watch(symbols, this.onLiveQuote);

    for (const symbol of symbols) {
      const quote = this.liveQuotes.latest(symbol);
      if (quote && this.settlesIn(symbol) === 0) await this.checkQuote(quote);
    }
  }

  private settlesIn(symbol: string): number {
    return Math.max(0, (this.watchedSince.get(symbol) ?? 0) + SETTLE_MS - Date.now());
  }

  private async checkQuote(quote: Quote): Promise<void> {
    // The latest trade, so a move after the close counts. A quote with no
    // price reads as 0, which would otherwise pass for a crash through every
    // "below" rule.
    const price = quote.extended?.price ?? quote.price;
    if (!(price > 0)) return;

    const now = new Date();
    await this.alertRepo.fireCrossed(quote.symbol, price, now, async (fired) => {
      await Promise.all(
        fired.map((alert) => {
          // The way it went, which a "both" rule only knows once it has crossed.
          const crossed = alert.armedFrom === "above" ? "below" : "above";
          return this.notify(alert, quote, price, crossed, Number(alert.price));
        }),
      );
    });
    await this.alertRepo.fireLive(quote.symbol, price, now, async (fired) => {
      await Promise.all(fired.map((f) => this.notify(f.alert, quote, price, f.crossed, f.level)));
    });
    await this.alertRepo.arm(quote.symbol, price);
  }

  // Checks a symbol's rules on its latest streamed price, at most once every
  // few seconds, so a burst of trades makes one check on the last of them.
  private onLiveQuote = (quote: Quote): void => {
    const check = this.liveChecks.get(quote.symbol) ?? { quote, timer: null, lastRun: 0 };
    check.quote = quote;
    this.liveChecks.set(quote.symbol, check);
    if (check.timer) return;
    const wait = Math.max(check.lastRun + LIVE_CHECK_EVERY_MS - Date.now(), this.settlesIn(quote.symbol), 0);
    check.timer = setTimeout(() => {
      check.timer = null;
      check.lastRun = Date.now();
      this.checkQuote(check.quote).catch((err) => {
        this.logger.error(`Live alert check for ${check.quote.symbol} failed: ${(err as Error).message}`);
      });
    }, wait);
  };

  // Only queues the push. Delivery is a job of its own, retried per device.
  private async notify(
    alert: PriceAlertsSelect,
    quote: Quote,
    price: number,
    crossed: PriceSide,
    level: number,
  ): Promise<void> {
    const session = quote.extended ? ` · ${SESSION_LABEL[quote.extended.session]}` : "";
    const devices = await this.pushService.enqueueToUser(alert.userId, {
      title: `${alert.symbol} crossed ${crossed} ${fmtPrice(level, quote.currency)}`,
      body: `Now ${fmtTraded(price, quote.currency)} ${quote.currency}${session}`,
      url: `/tabs/watchlist/symbol/${encodeURIComponent(alert.symbol)}`,
    });
    if (devices === 0) this.logger.info(`Alert ${alert.id} fired with no device subscribed`);
  }
}
