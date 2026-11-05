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

export type ExtendedHours = {
  session: "pre" | "post";
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
export type HistoryPoint = { date: string; close: number; volume?: number; session?: ExtendedHours["session"] };
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

export async function getFxRates(base: string, symbols: string[]): Promise<FxRatesResponse> {
  const res = await apiFetch(
    `/market/fx?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols.join(","))}`,
  );
  if (!res.ok) throw new Error("Failed to fetch fx rates");
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
