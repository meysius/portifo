import { SWLogger } from "simple-wire";
import { MarketService, Quote } from "@/domain/market/market.service";
import { PushService } from "@/domain/push/push.service";
import { AlertRepo } from "./alert.repo";
import { AlertDirection, PriceAlertsSelect } from "./alert.schema";

// One Yahoo request per check, however many rules there are: quotes are
// fetched in a single batch.
const CHECK_INTERVAL_MS = 60_000;

export type AlertInput = { direction: AlertDirection; price: number };

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

const SESSION_LABEL = { pre: "Pre-market", post: "After hours" } as const;

export class AlertService {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: SWLogger,
    private readonly alertRepo: AlertRepo,
    private readonly marketService: MarketService,
    private readonly pushService: PushService,
  ) {}

  async list(userId: string): Promise<PriceAlertsSelect[]> {
    return this.alertRepo.listByUser(userId);
  }

  async create(userId: string, symbol: string, input: AlertInput): Promise<PriceAlertsSelect> {
    return this.alertRepo.create({ userId, symbol, direction: input.direction, price: String(input.price) });
  }

  async update(userId: string, id: string, input: AlertInput): Promise<PriceAlertsSelect | null> {
    return this.alertRepo.update(userId, id, { direction: input.direction, price: String(input.price) });
  }

  async remove(userId: string, id: string): Promise<boolean> {
    return this.alertRepo.remove(userId, id);
  }

  startMonitor(): void {
    this.timer = setInterval(() => {
      // A slow check overlapping the next one is harmless: firing is atomic.
      this.checkAlerts().catch(() => this.logger.error("AlertService.checkAlerts failed"));
    }, CHECK_INTERVAL_MS);
  }

  stopMonitor(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async checkAlerts(): Promise<void> {
    const symbols = await this.alertRepo.listRunningSymbols();
    if (symbols.length === 0) return;

    const quotes = await this.marketService.getQuotes(symbols);
    for (const quote of quotes) {
      // The latest trade, so a move after the close counts. A quote with no
      // price reads as 0, which would otherwise pass for a crash through
      // every "below" rule.
      const price = quote.extended?.price ?? quote.price;
      if (!(price > 0)) continue;

      const fired = await this.alertRepo.fireCrossed(quote.symbol, price, new Date());
      await this.alertRepo.armApproaching(quote.symbol, price);
      await Promise.all(fired.map((alert) => this.notify(alert, quote, price)));
    }
  }

  // Recorded as fired whether or not this reaches a device: the rule's row
  // still says when it went off, and a late retry could arrive after the price
  // has moved back.
  private async notify(alert: PriceAlertsSelect, quote: Quote, price: number): Promise<void> {
    const session = quote.extended ? ` · ${SESSION_LABEL[quote.extended.session]}` : "";
    try {
      const { sent } = await this.pushService.sendToUser(alert.userId, {
        title: `${alert.symbol} crossed ${alert.direction} ${fmtPrice(Number(alert.price), quote.currency)}`,
        body: `Now ${fmtTraded(price, quote.currency)} ${quote.currency}${session}`,
        url: `/tabs/watchlist/symbol/${encodeURIComponent(alert.symbol)}`,
      });
      if (sent === 0) this.logger.info(`Alert ${alert.id} fired but reached no device`);
    } catch (err) {
      this.logger.error("AlertService.notify failed");
    }
  }
}
