import YahooFinance from "yahoo-finance2";
import { SWLogger } from "simple-wire";

export type Quote = {
  symbol: string;
  price: number;
  currency: string;
  changePercent: number;
  change: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  shortName?: string;
  exchange?: string;
  previousClose?: number;
  // Yahoo's session state: "REGULAR" while the market is open; "PRE"/"POST"
  // around it; "CLOSED" (or "PREPRE"/"POSTPOST") otherwise.
  marketState?: string;
  // When `price` was struck, ISO 8601.
  marketTime?: string;
};

// Yahoo returns epoch seconds without validation and a Date with it.
function toIso(t: unknown): string | undefined {
  if (t == null) return undefined;
  const d = typeof t === "number" ? new Date(t * 1000) : new Date(t as string | Date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// Volume is shares traded in the bar; the portfolio series has none.
export type HistoryPoint = { date: string; close: number; volume?: number };
export type HistoryRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "All";

// A moving average read off at one of a range's bars.
export type IndicatorPoint = { date: string; value: number };

// One 5-minute candle, dated at the start of its slot.
export type Candle = { date: string; open: number; high: number; low: number; close: number; volume: number };

// The last regular session as candles, bounded by the session's own hours
// (so a chart can lay out the whole day before it has traded), with the
// quote struck alongside them.
export type Intraday = { start: string; end: string; candles: Candle[]; quote: Quote | null };

const CANDLE_MS = 5 * 60_000;
// How long one Yahoo read serves every poll of a symbol. A failed read is
// held longer, so a refusing Yahoo isn't asked again by every poll.
const INTRADAY_TTL_MS = 4_000;
const INTRADAY_BACKOFF_MS = 30_000;

// The regular sessions a chart covers, oldest first. The schema promises
// Dates, but the array form (sent without pre/post hours) arrives as epoch
// seconds.
function sessionsOf(tradingPeriods: unknown): { start: number; end: number }[] {
  const list: any[] = Array.isArray(tradingPeriods) ? tradingPeriods : ((tradingPeriods as any)?.regular ?? []);
  const ms = (v: unknown) => (v instanceof Date ? v.getTime() : Number(v) * 1000);
  return list
    .flat()
    .map((p) => ({ start: ms(p?.start), end: ms(p?.end) }))
    .filter((s) => s.end > s.start);
}

export type SymbolResult = {
  symbol: string;
  name?: string;
  exchange?: string;
  type?: string;
};

// Yahoo currency-pair tickers are quoted as "<FROM><TO>=X" = units of TO per 1 FROM,
// so "<base><target>=X" already gives exactly the "1 base = N target" rate we want.
export const fxSymbol = (base: string, target: string) => `${base}${target}=X`;

// Where each range starts and how finely it is sampled.
function historyWindow(range: HistoryRange): { period1: Date; interval: "5m" | "15m" | "1h" | "1d" | "1wk" } {
  const period1 = new Date();
  switch (range) {
    case "1D":
      // The last SESSION, not the last 24h — on a weekend or holiday the last
      // 24h is empty. Five days covers any closure; getHistory makes the cut.
      period1.setDate(period1.getDate() - 5);
      return { period1, interval: "5m" };
    case "1W":
      period1.setDate(period1.getDate() - 7);
      return { period1, interval: "15m" };
    case "1M":
      // Hourly, as Apple Stocks draws a month: daily closes give ~21 points,
      // which read as a jagged polyline at this width.
      period1.setMonth(period1.getMonth() - 1);
      return { period1, interval: "1h" };
    case "3M":
      period1.setMonth(period1.getMonth() - 3);
      return { period1, interval: "1d" };
    case "6M":
      period1.setMonth(period1.getMonth() - 6);
      return { period1, interval: "1d" };
    case "1Y":
      period1.setFullYear(period1.getFullYear() - 1);
      return { period1, interval: "1d" };
    case "2Y":
      period1.setFullYear(period1.getFullYear() - 2);
      return { period1, interval: "1wk" };
    case "5Y":
      period1.setFullYear(period1.getFullYear() - 5);
      return { period1, interval: "1wk" };
    case "All":
      period1.setFullYear(period1.getFullYear() - 10);
      return { period1, interval: "1wk" };
  }
}

export class MarketService {
  private readonly client = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  private readonly intraday = new Map<string, { until: number; data: Promise<Intraday> }>();

  constructor(private readonly logger: SWLogger) {}

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    if (symbols.length === 0) return [];
    const results = await this.client.quote(symbols, {}, { validateResult: false });
    const list: any[] = Array.isArray(results) ? results : [results];
    return list
      .filter((q) => q && q.symbol)
      .map((q) => ({
        symbol: q.symbol,
        price: q.regularMarketPrice ?? 0,
        currency: q.currency ?? "USD",
        changePercent: q.regularMarketChangePercent ?? 0,
        change: q.regularMarketChange ?? 0,
        open: q.regularMarketOpen ?? 0,
        dayHigh: q.regularMarketDayHigh ?? 0,
        dayLow: q.regularMarketDayLow ?? 0,
        volume: q.regularMarketVolume ?? 0,
        shortName: q.shortName ?? q.longName,
        exchange: q.fullExchangeName,
        previousClose: q.regularMarketPreviousClose,
        marketState: q.marketState,
        marketTime: toIso(q.regularMarketTime),
      }));
  }

  // Rates are always expressed as "1 unit of `base` equals N units of the target
  // currency" — same convention as the prototype's Frankfurter-based state.fx.rates.
  async getFxRates(base: string, targets: string[]): Promise<Record<string, number>> {
    const wanted = targets.filter((t) => t !== base);
    if (wanted.length === 0) return {};
    const symbols = wanted.map((t) => fxSymbol(base, t));
    const results = await this.client.quote(symbols, {}, { validateResult: false });
    const list: any[] = Array.isArray(results) ? results : [results];
    const rates: Record<string, number> = {};
    for (const q of list) {
      if (!q?.symbol) continue;
      const target = q.symbol.slice(base.length, q.symbol.length - 2); // strip leading "<base>" and trailing "=X"
      if (q.regularMarketPrice) rates[target] = q.regularMarketPrice;
    }
    return rates;
  }

  async getHistory(symbol: string, range: HistoryRange): Promise<HistoryPoint[]> {
    const { period1, interval } = historyWindow(range);
    // Regular hours only: the chart's reference lines (prev close, today's
    // change) are regular-session figures, so extended-hours bars would end
    // the line somewhere the readout does not.
    const result = await this.client.chart(symbol, { period1, period2: new Date(), interval, includePrePost: false });
    const points: HistoryPoint[] = result.quotes
      .filter((q) => q.close != null)
      .map((q) => ({ date: q.date.toISOString(), close: q.close as number, volume: q.volume ?? 0 }));
    if (range !== "1D" || points.length === 0) return points;
    // Keep the last session: everything after the last overnight gap. Bars are
    // 5 minutes apart within a session (extended hours included, when Yahoo
    // sends them), so any gap over 2h is a session boundary.
    const ts = points.map((p) => new Date(p.date).getTime());
    let start = ts.length - 1;
    while (start > 0 && ts[start] - ts[start - 1] <= 2 * 3_600_000) start--;
    return points.slice(start);
  }

  // The last session's candles, polled while a market is open: one Yahoo
  // read per symbol serves every caller for a few seconds. `since` trims the
  // reply to the candles from that one on, the one still forming included.
  async getIntraday(symbol: string, since?: Date): Promise<Intraday> {
    let hit = this.intraday.get(symbol);
    if (!hit || hit.until <= Date.now()) {
      const entry = { until: Date.now() + INTRADAY_TTL_MS, data: this.readIntraday(symbol) };
      entry.data.catch(() => {
        entry.until = Date.now() + INTRADAY_BACKOFF_MS;
      });
      this.intraday.set(symbol, entry);
      hit = entry;
    }
    const day = await hit.data;
    if (!since) return day;
    const from = since.getTime();
    return { ...day, candles: day.candles.filter((c) => new Date(c.date).getTime() >= from) };
  }

  private async readIntraday(symbol: string): Promise<Intraday> {
    const period1 = new Date();
    // As for 1D history: five days reach back past any closure.
    period1.setDate(period1.getDate() - 5);
    const [chart, quotes] = await Promise.all([
      this.client.chart(symbol, { period1, period2: new Date(), interval: "5m", includePrePost: false }),
      this.getQuotes([symbol]).catch(() => []),
    ]);
    const rows = chart.quotes.filter((q) => q.open != null && q.high != null && q.low != null && q.close != null);
    const lastT = rows.length ? rows[rows.length - 1].date.getTime() : Date.now();
    // The session the latest row falls in. Without Yahoo's hours, the rows
    // since the last overnight gap stand in for it.
    let session = sessionsOf(chart.meta.tradingPeriods).findLast((s) => s.start <= lastT);
    if (!session) {
      let i = rows.length - 1;
      while (i > 0 && rows[i].date.getTime() - rows[i - 1].date.getTime() <= 2 * 3_600_000) i--;
      session = { start: rows[i]?.date.getTime() ?? lastT, end: lastT + CANDLE_MS };
    }
    const slots = Math.max(1, Math.round((session.end - session.start) / CANDLE_MS));

    const candles: Candle[] = [];
    for (const q of rows) {
      const t = q.date.getTime();
      if (t < session.start) continue;
      // The closing auction, stamped at the bell, belongs to the last slot.
      const slot = Math.min(Math.floor((t - session.start) / CANDLE_MS), slots - 1);
      const date = new Date(session.start + slot * CANDLE_MS).toISOString();
      const [open, high, low, close] = [q.open, q.high, q.low, q.close] as number[];
      const last = candles[candles.length - 1];
      if (last?.date === date) {
        // Yahoo trails the forming bar with a row of the live price, stamped
        // at its own time rather than the slot's: fold it in.
        last.high = Math.max(last.high, high);
        last.low = Math.min(last.low, low);
        last.close = close;
        last.volume += q.volume ?? 0;
      } else {
        candles.push({ date, open, high, low, close, volume: q.volume ?? 0 });
      }
    }
    return {
      start: new Date(session.start).toISOString(),
      end: new Date(session.end).toISOString(),
      candles,
      quote: quotes[0] ?? null,
    };
  }

  // The `window`-day simple moving average of daily closes, read off at each
  // of the range's bars: a daily bar takes its own day's average, a weekly bar
  // that of its last session. The daily series starts early enough (7 calendar
  // days to 5 sessions, plus slack for holidays) that the range's first bar
  // already has a full window behind it; a bar without one gets no point, so
  // a young listing's line starts late.
  async getSma(symbol: string, range: HistoryRange, window: number): Promise<IndicatorPoint[]> {
    const from = historyWindow(range).period1;
    from.setDate(from.getDate() - Math.ceil((window * 7) / 5) - 21);
    const [bars, daily] = await Promise.all([
      this.getHistory(symbol, range),
      this.client.chart(symbol, { period1: from, period2: new Date(), interval: "1d", includePrePost: false }),
    ]);
    const closes = daily.quotes
      .filter((q) => q.close != null)
      .map((q) => ({ t: q.date.getTime(), close: q.close as number }));
    const points: IndicatorPoint[] = [];
    let sum = 0;
    let n = 0; // sessions folded into the sum so far
    bars.forEach((bar, i) => {
      // A bar spans up to the next bar's start; the last one, to now.
      const end = i + 1 < bars.length ? new Date(bars[i + 1].date).getTime() : Infinity;
      while (n < closes.length && closes[n].t < end) {
        sum += closes[n].close;
        if (n >= window) sum -= closes[n - window].close;
        n++;
      }
      if (n >= window) points.push({ date: bar.date, value: sum / window });
    });
    return points;
  }

  // Historical counterpart to getFxRates — same "<base><target>=X" symbol, just
  // run through the chart endpoint instead of a live quote.
  async getFxHistory(base: string, target: string, range: HistoryRange): Promise<HistoryPoint[]> {
    if (base === target) return [];
    return this.getHistory(fxSymbol(base, target), range);
  }

  async searchSymbols(query: string): Promise<SymbolResult[]> {
    if (!query.trim()) return [];
    const result: any = await this.client.search(query, { quotesCount: 8, newsCount: 0 }, { validateResult: false });
    const quotes: any[] = Array.isArray(result?.quotes) ? result.quotes : [];
    return quotes
      .filter((q) => q?.isYahooFinance !== false && typeof q?.symbol === "string" && q.symbol.length > 0)
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortname ?? q.longname,
        exchange: q.exchDisp ?? q.exchange,
        type: q.typeDisp ?? q.quoteType,
      }));
  }
}
