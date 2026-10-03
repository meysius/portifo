import { CURRENCIES } from "./currencies";

// Rates are always expressed as "1 unit of USD equals N units of this currency" —
// USD is the pivot even when the display currency isn't USD, so any two currencies
// can be converted through it with a single rates map.
export type FxRates = Record<string, number>;

// Every currency the pickers offer must have a rate fetched for it — a code
// with no rate would fall through convert()'s `?? 1` and print dollar figures
// under a krona symbol.
export const DISPLAY_CURRENCIES = CURRENCIES.map((c) => c.code);

// Used only if the live /market/fx call fails, so a rate (and a "stale"
// indicator) is always available.
export const FX_FALLBACK: FxRates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.36,
  JPY: 151.2,
  AUD: 1.52,
  CHF: 0.88,
  SEK: 10.5,
};

export function convert(amount: number, fromCcy: string, toCcy: string, rates: FxRates): number {
  if (fromCcy === toCcy) return amount;
  const usd = fromCcy === "USD" ? amount : amount / (rates[fromCcy] ?? 1);
  return toCcy === "USD" ? usd : usd * (rates[toCcy] ?? 1);
}

export function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Currency-symbol-prefixed money, matching the design system's value idiom
// ("$49,730.55", "€228.00", "avg $190.20"). narrowSymbol keeps "$"/"€"/"£"
// glyphs instead of "US$"/"CA$" prefixes. Falls back to "1,234.00 XYZ" for
// codes Intl doesn't know.
export function fmtCcy(n: number, currency: string): string {
  try {
    // DS typography uses the true minus (U+2212), not the hyphen Intl emits.
    return n
      .toLocaleString("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .replace(/^-/, "−");
  } catch {
    return `${fmtMoney(n)} ${currency}`;
  }
}

// When the live fx rates were fetched: a time today, a date before that.
export function fmtFxAsOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

// Whole share counts render bare ("46"); fractional ones keep up to 4
// decimals with trailing zeros trimmed, as the ledger stores them — rounding
// 3.4521 sh to "3.45" made a holding disagree with its own transactions.
export function fmtShares(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

// Compact age for a position or a lot: "3y 4m", "8m", "12d". The design uses
// this everywhere an age appears (stat grid, lot rows), so a lot's age and the
// position's weighted-average age read in the same units.
export function fmtAge(years: number): string {
  if (!Number.isFinite(years) || years <= 0) return "—";
  const totalMonths = Math.round(years * 12);
  if (totalMonths < 1) {
    const days = Math.max(1, Math.round(years * 365.25));
    return `${days}d`;
  }
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m}m`;
  return m === 0 ? `${y}y` : `${y}y ${m}m`;
}

// The chart lives at the provider that already supplies our prices. The API
// prices through `yahoo-finance2` (portifo-api market.service.ts), so every
// symbol stored here IS a Yahoo symbol — exchange suffixes (.TO, .L) included —
// and this link cannot resolve to a different instrument. TradingView would
// need an exchange prefix (NASDAQ-NVDA) the app does not store.
export function yahooQuoteUrl(symbol: string): string {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
}
