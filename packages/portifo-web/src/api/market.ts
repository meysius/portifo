import { apiFetch } from "./http";
import type { FxRates } from "../lib/fx";

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
  // "REGULAR" while the market is open; "PRE"/"POST"/"CLOSED"/… otherwise.
  marketState?: string;
  // When `price` was struck, ISO 8601.
  marketTime?: string;
  // The latest trade outside the regular session, when one followed it.
  // `price` stays the regular session's, so positions never value on this.
  extended?: ExtendedHours;
};

// Overnight is the US listings' 8pm–4am ET session, which only the live
// stream reports.
export type ExtendedHours = {
  session: "pre" | "post" | "overnight";
  price: number;
  // Against the quote's `price`: the move since the regular session closed.
  change: number;
  changePercent: number;
  // When `price` was struck, ISO 8601.
  time: string;
};

export const EXTENDED_LABEL: Record<ExtendedHours["session"], string> = {
  pre: "Pre-market",
  post: "After hours",
  overnight: "Overnight",
};

// The envelope returned by GET /market/fx — named distinctly from lib/fx.ts's
// `FxRates` (the plain rate map) so both can be imported side by side without
// a name collision.
export type FxRatesResponse = {
  base: string;
  rates: FxRates;
  asOf: string;
};

// Volume is shares traded in the bar; the portfolio series has none. A bar
// struck outside the regular session names it; only an extended 1D has any.
export type HistoryPoint = { date: string; close: number; volume?: number; session?: "pre" | "post" };
export type HistoryRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "All";

// A moving average read off at one of a range's bars (same dates as
// getHistory's); bars without a full window behind them have no point.
export type IndicatorPoint = { date: string; value: number };

// When a company published a quarter's results, to the minute, ISO 8601.
export type EarningsReport = { date: string };

export type SymbolResult = {
  symbol: string;
  name?: string;
  exchange?: string;
  type?: string;
};

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const res = await apiFetch(`/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) throw new Error("Failed to fetch quotes");
  return res.json();
}

// When a quote's latest trade was struck, extended hours included: of two
// quotes for a symbol, the later one stands.
export function quoteTime(q: Quote): number {
  const regular = q.marketTime ? Date.parse(q.marketTime) : 0;
  const extended = q.extended ? Date.parse(q.extended.time) : 0;
  return Math.max(regular, extended);
}

// Yahoo's ticker for a currency pair, "units of `to` per 1 `from`".
export const fxSymbol = (from: string, to: string) => `${from}${to}=X`;

// Live quotes for `symbols`, pushed by the API as they move (about once a
// second at most): each one as soon as the stream opens, then on every trade.
// Only while the app is on screen. iOS cuts a backgrounded app's connections,
// so the stream closes when the page hides and reopens when it shows, which
// also brings every quote up to date on return.
//
// Returns a function that stops it.
export function streamQuotes(symbols: string[], onQuotes: (quotes: Quote[]) => void): () => void {
  const url = `/market/stream?symbols=${encodeURIComponent(symbols.join(","))}`;
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;

  const close = () => {
    clearTimeout(timer);
    source?.close();
    source = null;
  };

  const open = () => {
    close();
    const es = new EventSource(url);
    source = es;
    es.addEventListener("quotes", (e) => {
      failures = 0;
      onQuotes(JSON.parse((e as MessageEvent<string>).data));
    });
    // EventSource reconnects a dropped stream by itself. It gives up only
    // when the server turns it away (a 401, a 502, a restart mid-deploy),
    // and then this tries again: 5s, 10s, 20s… up to a minute.
    es.onerror = () => {
      if (es.readyState !== EventSource.CLOSED || source !== es) return;
      failures += 1;
      timer = setTimeout(open, Math.min(60_000, 5_000 * 2 ** (failures - 1)));
    };
  };

  const onVisibility = () => {
    if (document.hidden) close();
    else open();
  };

  document.addEventListener("visibilitychange", onVisibility);
  // A beat's wait, so a screen that asks for several quotes in a row opens
  // one stream for all of them rather than one each.
  if (!document.hidden) timer = setTimeout(open, 300);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    close();
  };
}

export async function getFxRates(base: string, symbols: string[]): Promise<FxRatesResponse> {
  const res = await apiFetch(
    `/market/fx?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols.join(","))}`,
  );
  if (!res.ok) throw new Error("Failed to fetch fx rates");
  return res.json();
}

// A watchlist row's line: one trading day of 5-minute closes on that day's
// own clock. All times epoch ms. `start`–`end` is the span the line is drawn
// across (the regular session, or with extended hours the pre-market's start
// to the after-hours' end) and `open`–`close` the regular session within it.
// A market that never closes (crypto, FX) gets the 24 hours to its latest
// bar, and `rolling`.
export type Spark = {
  start: number;
  end: number;
  open: number;
  close: number;
  // [time, close], oldest first.
  points: [number, number][];
  rolling?: true;
};

// The lines for `symbols`, by symbol; one Yahoo has no chart for is missing.
export async function getSparks(symbols: string[], extended: boolean): Promise<Record<string, Spark>> {
  if (symbols.length === 0) return {};
  const res = await apiFetch(
    `/market/sparks?symbols=${encodeURIComponent(symbols.join(","))}${extended ? "&extended=1" : ""}`,
  );
  if (!res.ok) throw new Error("Failed to fetch charts");
  return res.json();
}

// `extended`: a 1D with the day's pre-market and after-hours trading too.
export async function getHistory(symbol: string, range: HistoryRange, extended = false): Promise<HistoryPoint[]> {
  const res = await apiFetch(
    `/market/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}${extended ? "&extended=1" : ""}`,
  );
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// The `window`-day simple moving average of daily closes, read off at each of
// the range's bars (getHistory's, extended or not). An intraday bar takes its
// session's average; a pre-market bar, the one before.
export async function getSma(
  symbol: string,
  range: HistoryRange,
  window: number,
  extended = false,
): Promise<IndicatorPoint[]> {
  const res = await apiFetch(
    `/market/sma?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&window=${window}${extended ? "&extended=1" : ""}`,
  );
  if (!res.ok) throw new Error("Failed to fetch moving average");
  return res.json();
}

// Every earnings report the company has published, oldest first (about 25
// years). Funds, crypto and currencies have none.
export async function getEarnings(symbol: string): Promise<EarningsReport[]> {
  const res = await apiFetch(`/market/earnings?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch earnings");
  return res.json();
}

export async function searchSymbols(query: string): Promise<SymbolResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const res = await apiFetch(`/market/search?q=${encodeURIComponent(trimmed)}`);
  if (!res.ok) throw new Error("Failed to search symbols");
  return res.json();
}
