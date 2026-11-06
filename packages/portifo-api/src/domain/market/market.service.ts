import YahooFinance from "yahoo-finance2";
import type { ChartMetaTradingPeriods } from "yahoo-finance2/modules/chart";
import { SWLogger } from "simple-wire";
import { buildSpark, Spark } from "./spark";

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
  // The latest trade outside the regular session, when one followed it.
  // `price` stays the regular session's, so positions never value on this.
  extended?: ExtendedHours;
};

// Overnight is the US listings' 8pm–4am ET session, which only the live
// feed reports; Yahoo's quotes stop at the after-hours close.
export type ExtendedHours = {
  session: "pre" | "post" | "overnight";
  price: number;
  // Against the quote's `price`: the move since the regular session closed.
  change: number;
  changePercent: number;
  // When `price` was struck, ISO 8601.
  time: string;
};

// Yahoo returns epoch seconds without validation and a Date with it.
function toIso(t: unknown): string | undefined {
  if (t == null) return undefined;
  const d = typeof t === "number" ? new Date(t * 1000) : new Date(t as string | Date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// Goes by the timestamps, so an earlier session's fields can't pass for the
// latest price. Many symbols carry neither: Toronto, London, crypto, FX, indices.
function extendedHours(q: any): ExtendedHours | undefined {
  if (q.marketState === "REGULAR") return undefined;
  const close = toIso(q.regularMarketTime) ?? "";
  return (["pre", "post"] as const)
    .map((session) => ({
      session: session as ExtendedHours["session"],
      price: q[`${session}MarketPrice`],
      change: q[`${session}MarketChange`] ?? 0,
      changePercent: q[`${session}MarketChangePercent`] ?? 0,
      time: toIso(q[`${session}MarketTime`]),
    }))
    .filter((s): s is ExtendedHours => s.price > 0 && s.time != null && s.time > close)
    .sort((a, b) => b.time.localeCompare(a.time))[0];
}

function toQuote(q: any): Quote {
  return {
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
    extended: extendedHours(q),
  };
}

// A quote and whether its listing trades pre-market and after hours: US
// listings mostly do; Toronto, London, crypto, FX and indices don't.
export type QuoteSnapshot = { quote: Quote; extendedHours: boolean };

// Volume is shares traded in the bar; the portfolio series has none. A bar
// struck outside the regular session names it; only an extended 1D has any.
export type HistoryPoint = { date: string; close: number; volume?: number; session?: Session };
export type Session = "pre" | "post";
export type HistoryRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "All";

// A moving average read off at one of a range's bars.
export type IndicatorPoint = { date: string; value: number };

// When a company published a quarter's results, to the minute, ISO 8601.
export type EarningsReport = { date: string };

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

// Yahoo's trading periods arrive as epoch seconds or as Dates, whatever the
// schema says.
function toMs(t: unknown): number {
  return typeof t === "number" ? t * 1000 : new Date(t as string | Date).getTime();
}

const SESSION_GAP_MS = 2 * 3_600_000;

// The last session: everything after the last overnight gap. Bars are 5
// minutes apart within a session, so any gap over 2h is a session boundary.
function lastSession(points: HistoryPoint[]): HistoryPoint[] {
  const ts = points.map((p) => new Date(p.date).getTime());
  let start = ts.length - 1;
  while (start > 0 && ts[start] - ts[start - 1] <= SESSION_GAP_MS) start--;
  return points.slice(start);
}

// One trading day with its extended hours: from the pre-market's start, and
// the regular session's open and close.
type TradingDay = { start: number; open: number; close: number };

// A listing's trading days, when Yahoo sends extended hours for it: only then
// are its periods split into pre, regular and post (an object, where regular
// hours alone come as a list of lists). US listings mostly have them; Toronto,
// London, crypto, FX and indices don't.
function extendedDays(periods: unknown): TradingDay[] {
  if (!periods || Array.isArray(periods)) return [];
  const { pre = [], regular = [] } = periods as ChartMetaTradingPeriods;
  const preStarts = new Map(pre.flat().map((p) => [toMs(p.end), toMs(p.start)]));
  return regular
    .flat()
    .map((r) => {
      const open = toMs(r.start);
      // Its pre-market ends at its open.
      return { start: preStarts.get(open) ?? open, open, close: toMs(r.end) };
    })
    .filter((d) => d.close > d.open)
    .sort((a, b) => a.start - b.start);
}

// The latest trading day from its pre-market to its after-hours, each bar
// outside the regular session named for its side of it. In the first minutes
// of a pre-market there is one bar or none, nothing to draw a line through, so
// the day before stands until there are two.
function lastExtendedDay(points: HistoryPoint[], days: TradingDay[]): HistoryPoint[] {
  const ts = points.map((p) => new Date(p.date).getTime());
  let d = days.findLastIndex((day) => day.start <= ts[ts.length - 1]);
  if (d < 0) return lastSession(points);
  let from = ts.findIndex((t) => t >= days[d].start);
  let to = ts.length;
  if (to - from < 2 && d > 0) {
    to = from;
    d--;
    from = ts.findIndex((t) => t >= days[d].start);
  }
  const { open, close } = days[d];
  return points.slice(from, to).map((p, i) => {
    const t = ts[from + i];
    return t < open ? { ...p, session: "pre" } : t >= close ? { ...p, session: "post" } : p;
  });
}

// The watchlist's lines: how long one is held, and how many charts are asked
// for at once.
const SPARK_TTL_MS = 60_000;
const SPARK_CONCURRENCY = 4;

// A background job waits on quotes, and a hung one would hold its slot forever.
const QUOTE_TIMEOUT_MS = 15_000;

// Yahoo's earnings calendar, the S&P feed behind its earnings pages, which
// yahoo-finance2 doesn't wrap. It holds each report's time back to the early
// 2000s, plus the next one scheduled. Yahoo's older "earnings" feed on the
// same endpoint stopped in May 2025, and quoteSummary keeps only the last
// four or five quarters.
const EARNINGS_URL = "https://query1.finance.yahoo.com/v1/finance/visualization";
// About 25 years of quarters, well past the longest range.
const EARNINGS_LIMIT = 100;
const EARNINGS_REPEAT_MS = 3 * 86_400_000;

export class MarketService {
  private readonly client = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  // Each symbol's line by when it was fetched, keyed with its extended hours.
  private readonly sparkCache = new Map<string, { at: number; spark: Spark | null }>();

  constructor(private readonly logger: SWLogger) {}

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    return (await this.fetchQuotes(symbols)).map(toQuote);
  }

  // Quotes, each with whether its listing trades before and after the
  // regular session, which the live feed needs to place a trade.
  async getQuoteSnapshots(symbols: string[]): Promise<QuoteSnapshot[]> {
    return (await this.fetchQuotes(symbols)).map((q) => ({
      quote: toQuote(q),
      extendedHours: q.hasPrePostMarketData === true,
    }));
  }

  private async fetchQuotes(symbols: string[]): Promise<any[]> {
    if (symbols.length === 0) return [];
    const results = await this.client.quote(
      symbols,
      {},
      { validateResult: false, fetchOptions: { signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS) } },
    );
    const list: any[] = Array.isArray(results) ? results : [results];
    return list.filter((q) => q && q.symbol);
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

  // Regular hours only, unless `extended` asks a 1D for the day's pre-market
  // and after-hours trading too, each such bar named by its session. The
  // figures around a chart (the price, today's move) stay regular-session
  // either way.
  async getHistory(symbol: string, range: HistoryRange, extended = false): Promise<HistoryPoint[]> {
    const { period1, interval } = historyWindow(range);
    const includePrePost = extended && range === "1D";
    const result = await this.client.chart(symbol, { period1, period2: new Date(), interval, includePrePost });
    const points: HistoryPoint[] = result.quotes
      .filter((q) => q.close != null)
      .map((q) => ({ date: q.date.toISOString(), close: q.close as number, volume: q.volume ?? 0 }));
    if (range !== "1D" || points.length === 0) return points;
    // The last session, not the last 24h (see historyWindow). A listing that
    // trades outside regular hours has its days marked out by Yahoo; a thin
    // pre-market can go quiet for two hours, so a gap can't be trusted there.
    const days = includePrePost ? extendedDays(result.meta.tradingPeriods) : [];
    return days.length ? lastExtendedDay(points, days) : lastSession(points);
  }

  // The watchlist's lines: each symbol's latest trading day (see Spark), with
  // its pre-market and after-hours when `extended`. A symbol whose chart
  // can't be had is left out; the row draws without a line. Each is held a
  // minute, so the list's every visit doesn't ask Yahoo again.
  async getSparks(symbols: string[], extended: boolean): Promise<Record<string, Spark>> {
    const now = Date.now();
    for (const [key, hit] of this.sparkCache) if (now - hit.at >= SPARK_TTL_MS) this.sparkCache.delete(key);
    const out: Record<string, Spark> = {};
    const queue = [...new Set(symbols)];
    const work = async () => {
      for (let symbol = queue.shift(); symbol; symbol = queue.shift()) {
        try {
          const spark = await this.getSpark(symbol, extended);
          if (spark) out[symbol] = spark;
        } catch {
          this.logger.info(`MarketService.getSparks: no chart for ${symbol}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SPARK_CONCURRENCY, queue.length) }, work));
    return out;
  }

  private async getSpark(symbol: string, extended: boolean): Promise<Spark | null> {
    const key = `${symbol}|${extended ? "extended" : "regular"}`;
    const hit = this.sparkCache.get(key);
    if (hit && Date.now() - hit.at < SPARK_TTL_MS) return hit.spark;
    // Five days, as 1D's history: enough to reach the last session over a
    // long weekend.
    const period1 = new Date(Date.now() - 5 * 86_400_000);
    const result = await this.client.chart(symbol, { period1, period2: new Date(), interval: "5m", includePrePost: extended });
    const spark = buildSpark(result, extended);
    this.sparkCache.set(key, { at: Date.now(), spark });
    return spark;
  }

  // The `window`-day simple moving average of daily closes, read off at each
  // of the range's bars: a daily bar takes its own day's average, a weekly bar
  // that of its last session, and an hourly or 5- or 15-minute bar that of its
  // session, so the line holds still through a session and steps between
  // them. A session's average counts its own close; today's counts the latest
  // price. The daily series starts early enough (7 calendar
  // days to 5 sessions, plus slack for holidays) that the range's first bar
  // already has a full window behind it; a bar without one gets no point, so
  // a young listing's line starts late.
  // With `extended` (1D only), the bars include the day's pre-market and
  // after-hours: a pre-market bar takes the average up to the session before.
  async getSma(symbol: string, range: HistoryRange, window: number, extended = false): Promise<IndicatorPoint[]> {
    const from = historyWindow(range).period1;
    from.setDate(from.getDate() - Math.ceil((window * 7) / 5) - 21);
    const [bars, daily] = await Promise.all([
      this.getHistory(symbol, range, extended),
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

  // The times `symbol`'s company reported earnings, oldest first. Funds,
  // crypto and currencies report none. A scheduled report stays out until its
  // time has passed.
  async getEarnings(symbol: string): Promise<EarningsReport[]> {
    const body = JSON.stringify({
      size: EARNINGS_LIMIT,
      query: { operator: "eq", operands: ["ticker", symbol] },
      sortField: "startdatetime",
      sortType: "DESC",
      entityIdType: "sp_earnings",
      includeFields: ["startdatetime"],
    });
    // The library's own fetch, for the cookie and crumb Yahoo demands. It
    // only sends GETs, so this one request becomes the POST the endpoint
    // takes. The crumb's own requests run through here too and pass untouched.
    const post = (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).startsWith(EARNINGS_URL)
        ? fetch(input, {
            ...init,
            method: "POST",
            body,
            headers: { ...(init?.headers as Record<string, string>), "content-type": "application/json" },
          })
        : fetch(input, init);
    // `_fetch` is the library's internal request helper: (url, query, module
    // options, response type, needs a crumb).
    const result = await (this.client as any)._fetch(
      EARNINGS_URL,
      { lang: "en-US", region: "US" },
      { fetch: post },
      "json",
      true,
    );
    const doc = result?.finance?.result?.[0]?.documents?.[0];
    const at = (doc?.columns ?? []).findIndex((c: { id?: string }) => c.id === "startdatetime");
    if (at < 0) return [];
    const now = Date.now();
    const times = (doc.rows as unknown[][])
      .map((row) => Date.parse(String(row[at])))
      .filter((t) => t <= now)
      .sort((a, b) => a - b);
    // The feed sometimes lists one report twice, hours apart (Berkshire's
    // Aug 8, 2026 at 12:00 and 20:00). Reports come a quarter apart, so any
    // within a few days of the one before are that one again: keep the first.
    return times
      .filter((t, i) => i === 0 || t - times[i - 1] > EARNINGS_REPEAT_MS)
      .map((t) => ({ date: new Date(t).toISOString() }));
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
