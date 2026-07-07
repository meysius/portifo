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
};

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
    this.logger.info("MarketService.getQuotes called");
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
      }));
  }

  // Rates are always expressed as "1 unit of `base` equals N units of the target
  // currency" — same convention as the prototype's Frankfurter-based state.fx.rates.
  async getFxRates(base: string, targets: string[]): Promise<Record<string, number>> {
    const wanted = targets.filter((t) => t !== base);
    if (wanted.length === 0) return {};
    this.logger.info("MarketService.getFxRates called");
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
    this.logger.info("MarketService.getHistory called");
    const period2 = new Date();
    const period1 = new Date(period2);
    let interval: "5m" | "15m" | "1d" | "1wk" = "1d";
    switch (range) {
      case "1D":
        period1.setDate(period1.getDate() - 1);
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
    const result = await this.client.chart(symbol, { period1, period2, interval });
    return result.quotes.filter((q) => q.close != null).map((q) => ({ date: q.date.toISOString(), close: q.close as number }));
  }

  // Historical counterpart to getFxRates — same "<base><target>=X" symbol, just
  // run through the chart endpoint instead of a live quote.
  async getFxHistory(base: string, target: string, range: HistoryRange): Promise<HistoryPoint[]> {
    if (base === target) return [];
    this.logger.info("MarketService.getFxHistory called");
    return this.getHistory(fxSymbol(base, target), range);
  }

  async searchSymbols(query: string): Promise<SymbolResult[]> {
    if (!query.trim()) return [];
    this.logger.info("MarketService.searchSymbols called");
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
