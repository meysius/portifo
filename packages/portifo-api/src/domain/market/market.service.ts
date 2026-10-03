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

export type HistoryPoint = { date: string; close: number };
export type HistoryRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "All";

export type SymbolResult = {
  symbol: string;
  name?: string;
  exchange?: string;
  type?: string;
};

// Yahoo currency-pair tickers are quoted as "<FROM><TO>=X" = units of TO per 1 FROM,
// so "<base><target>=X" already gives exactly the "1 base = N target" rate we want.
export const fxSymbol = (base: string, target: string) => `${base}${target}=X`;

export class MarketService {
  private readonly client = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

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
    const period2 = new Date();
    const period1 = new Date(period2);
    let interval: "5m" | "15m" | "1d" | "1wk" = "1d";
    switch (range) {
      case "1D":
        // The last SESSION, not the last 24h — on a weekend or holiday the last
        // 24h is empty. Five days covers any closure; the cut happens below.
        period1.setDate(period1.getDate() - 5);
        interval = "5m";
        break;
      case "1W":
        period1.setDate(period1.getDate() - 7);
        interval = "15m";
        break;
      case "1M":
        period1.setMonth(period1.getMonth() - 1);
        interval = "1d";
        break;
      case "3M":
        period1.setMonth(period1.getMonth() - 3);
        interval = "1d";
        break;
      case "6M":
        period1.setMonth(period1.getMonth() - 6);
        interval = "1d";
        break;
      case "1Y":
        period1.setFullYear(period1.getFullYear() - 1);
        interval = "1d";
        break;
      case "2Y":
        period1.setFullYear(period1.getFullYear() - 2);
        interval = "1wk";
        break;
      case "5Y":
        period1.setFullYear(period1.getFullYear() - 5);
        interval = "1wk";
        break;
      case "All":
        period1.setFullYear(period1.getFullYear() - 10);
        interval = "1wk";
        break;
    }
    // Regular hours only: the chart's reference lines (prev close, today's
    // change) are regular-session figures, so extended-hours bars would end
    // the line somewhere the readout does not.
    const result = await this.client.chart(symbol, { period1, period2, interval, includePrePost: false });
    const points = result.quotes.filter((q) => q.close != null).map((q) => ({ date: q.date.toISOString(), close: q.close as number }));
    if (range !== "1D" || points.length === 0) return points;
    // Keep the last session: everything after the last overnight gap. Bars are
    // 5 minutes apart within a session (extended hours included, when Yahoo
    // sends them), so any gap over 2h is a session boundary.
    const ts = points.map((p) => new Date(p.date).getTime());
    let start = ts.length - 1;
    while (start > 0 && ts[start] - ts[start - 1] <= 2 * 3_600_000) start--;
    return points.slice(start);
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
