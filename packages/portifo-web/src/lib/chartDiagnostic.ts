// TEMPORARY — DELETE ONCE THE CHART GAP IS FOUND.
//
// Prints, from the browser, everything needed to explain why the Portfolio hero
// and the value chart disagree. It exists because prod runs on a VM this laptop
// has no SSH key for, so the console is the only way to read prod's numbers.
//
// The two figures come from different places, which is the whole problem:
//   hero  = stored currency_balances + live quotes, summed client-side
//   chart = the ledger replayed server-side against historical prices and fx
// so this logs both, and the pieces each is built from, side by side.
//
// Emits ONE JSON string so it can be copied out of the console in a single
// selection rather than expanding twenty collapsed objects.

import type { HistoryPoint } from "../api/market";
import { convert } from "./fx";

type Position = {
  symbol: string;
  shares: number;
  price: number;
  currency: string;
};

export type ChartDiagnosticInput = {
  portfolioName: string | undefined;
  portfolioId: string | undefined;
  displayCurrency: string;
  range: string;
  cashByCurrency: Record<string, number>;
  fxRates: Record<string, number>;
  fxAsOf: string | null;
  positions: Position[];
  points: HistoryPoint[];
  estimatedTickers: string[];
  estimatedCurrencies: string[];
  reconciledCash: { currency: string; amount: number }[];
};

export function logChartDiagnostic(input: ChartDiagnosticInput): void {
  const {
    portfolioName,
    portfolioId,
    displayCurrency,
    range,
    cashByCurrency,
    fxRates,
    fxAsOf,
    positions,
    points,
    estimatedTickers,
    estimatedCurrencies,
    reconciledCash,
  } = input;

  const cash = Object.entries(cashByCurrency)
    .filter(([, amount]) => Math.abs(amount) > 1e-9)
    .map(([currency, amount]) => ({
      currency,
      amount: round(amount),
      rateUsed: currency === displayCurrency ? 1 : (fxRates[currency] ?? null),
      inDisplay: round(convert(amount, currency, displayCurrency, fxRates)),
    }));
  const cashTotal = cash.reduce((sum, c) => sum + c.inDisplay, 0);

  const holdings = positions.map((p) => ({
    symbol: p.symbol,
    shares: p.shares,
    price: p.price,
    currency: p.currency,
    inDisplay: round(convert(p.price * p.shares, p.currency, displayCurrency, fxRates)),
  }));
  const holdingsTotal = holdings.reduce((sum, h) => sum + h.inDisplay, 0);

  const hero = cashTotal + holdingsTotal;
  const last = points.length ? points[points.length - 1] : null;
  const chartLast = last ? last.close : null;

  // The chart's cash, recovered by subtracting the holdings from its last
  // point. Carries the intraday live-vs-close drift with it, which is noise at
  // the scale of the gap being chased.
  const chartCashImplied = chartLast == null ? null : round(chartLast - holdingsTotal);

  // A price series that simply STOPS early drags the chart's right edge back in
  // time with it, so the curve ends on a total that is genuinely days old.
  const ageHours = last ? round((Date.now() - new Date(last.date).getTime()) / 3_600_000, 2) : null;

  const payload = {
    _: "PORTIFO CHART DIAGNOSTIC — copy this whole block",
    when: new Date().toISOString(),
    portfolio: { name: portfolioName ?? null, id: portfolioId ?? null },
    displayCurrency,
    range,
    fx: { asOf: fxAsOf, rates: fxRates },
    cash,
    holdings,
    totals: {
      heroCash: round(cashTotal),
      heroHoldings: round(holdingsTotal),
      hero: round(hero),
      chartLastPoint: chartLast == null ? null : round(chartLast),
      gap: chartLast == null ? null : round(hero - chartLast),
    },
    attribution: {
      chartCashImplied,
      cashGap: chartCashImplied == null ? null : round(cashTotal - chartCashImplied),
      note: "cashGap ~= the whole gap -> balances never entered the ledger; ~0 -> look at holdings",
    },
    series: {
      points: points.length,
      firstDate: points[0]?.date ?? null,
      lastDate: last?.date ?? null,
      lastPointAgeHours: ageHours,
      staleWarning: ageHours != null && ageHours > 48 ? "RIGHT EDGE IS STALE — the grid ends days ago" : null,
      firstClose: points[0] ? round(points[0].close) : null,
      lastClose: chartLast == null ? null : round(chartLast),
    },
    serverReported: { estimatedTickers, estimatedCurrencies, reconciledCash },
    buildHasEstimateFix: Array.isArray(estimatedTickers),
  };

  console.log("%cPORTIFO CHART DIAGNOSTIC", "font-weight:bold;font-size:14px");
  console.log(JSON.stringify(payload, null, 2));
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
