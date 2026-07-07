// Rates are always expressed as "1 unit of USD equals N units of this currency" —
// USD is the pivot even when the display currency isn't USD, so any two currencies
// can be converted through it with a single rates map.
export type FxRates = Record<string, number>;

export const DISPLAY_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "JPY", "AUD"];

// Used only if the live /market/fx call fails, so a rate (and a "stale"
// indicator) is always available.
export const FX_FALLBACK: FxRates = { USD: 1, EUR: 0.92, GBP: 0.78, CAD: 1.36, JPY: 151.2, AUD: 1.52 };

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

export function fmtPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

// Whole share counts render bare ("46"), fractional ones keep precision.
export function fmtShares(n: number) {
  if (Number.isInteger(n)) return n.toFixed(0);
  return Math.abs(n) < 1 ? n.toFixed(3) : n.toFixed(2);
}
