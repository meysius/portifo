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
};

// The envelope returned by GET /market/fx — named distinctly from lib/fx.ts's
// `FxRates` (the plain rate map) so both can be imported side by side without
// a name collision.
export type FxRatesResponse = {
  base: string;
  rates: FxRates;
  asOf: string;
};

// Volume is shares traded in the bar; the portfolio series has none.
export type HistoryPoint = { date: string; close: number; volume?: number };
export type HistoryRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "All";

// A moving average read off at one of a range's bars (same dates as
// getHistory's); bars without a full window behind them have no point.
export type IndicatorPoint = { date: string; value: number };

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

export async function getHistory(symbol: string, range: HistoryRange): Promise<HistoryPoint[]> {
  const res = await apiFetch(`/market/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// The `window`-day simple moving average of daily closes, for 3M and longer.
export async function getSma(symbol: string, range: HistoryRange, window: number): Promise<IndicatorPoint[]> {
  const res = await apiFetch(
    `/market/sma?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&window=${window}`,
  );
  if (!res.ok) throw new Error("Failed to fetch moving average");
  return res.json();
}

export async function searchSymbols(query: string): Promise<SymbolResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const res = await apiFetch(`/market/search?q=${encodeURIComponent(trimmed)}`);
  if (!res.ok) throw new Error("Failed to search symbols");
  return res.json();
}
