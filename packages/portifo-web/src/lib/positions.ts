import type { Transaction } from "../api/portfolio";

export type OpenPosition = {
  symbol: string;
  shares: number;
  costByCurrency: [string, number][];
};

function totalCost(costByCurrency: [string, number][]) {
  return costByCurrency.reduce((sum, [, amount]) => sum + amount, 0);
}

// Net shares and remaining cost basis per ticker for one account. Walks buy/sell
// transactions in date order per (ticker, currency) using average cost — same
// ledger method as computeRealizedPLByTransaction — so a sell removes its avg-cost
// share of the basis rather than netting against the sale price. There's no live
// market price feed here, so this is money still deployed in the position, not
// mark-to-market value.
export function computeOpenPositions(accountName: string, transactions: Transaction[]): OpenPosition[] {
  const byDateAsc = transactions
    .filter((tx) => tx.account === accountName && (tx.type === "buy" || tx.type === "sell"))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const ledgers = new Map<string, { symbol: string; currency: string; shares: number; costBasis: number }>();

  for (const tx of byDateAsc) {
    const symbol = tx.symbol ?? "";
    const key = `${symbol}|${tx.currency}`;
    const ledger = ledgers.get(key) ?? { symbol, currency: tx.currency, shares: 0, costBasis: 0 };
    const shares = tx.shares ?? 0;
    const price = tx.pricePerShare ?? 0;
    if (tx.type === "buy") {
      ledger.costBasis += shares * price;
      ledger.shares += shares;
    } else {
      const avgCost = ledger.shares > 0 ? ledger.costBasis / ledger.shares : 0;
      const sellShares = Math.min(shares, ledger.shares);
      ledger.costBasis -= avgCost * sellShares;
      ledger.shares -= sellShares;
    }
    ledgers.set(key, ledger);
  }

  const bySymbol = new Map<string, { shares: number; costByCurrency: Map<string, number> }>();
  for (const ledger of ledgers.values()) {
    if (ledger.shares <= 1e-9) continue;
    const entry = bySymbol.get(ledger.symbol) ?? { shares: 0, costByCurrency: new Map<string, number>() };
    entry.shares += ledger.shares;
    entry.costByCurrency.set(ledger.currency, (entry.costByCurrency.get(ledger.currency) ?? 0) + ledger.costBasis);
    bySymbol.set(ledger.symbol, entry);
  }

  return [...bySymbol.entries()]
    .map(([symbol, v]) => ({
      symbol,
      shares: v.shares,
      costByCurrency: [...v.costByCurrency.entries()].filter(([, amount]) => Math.abs(amount) > 1e-9),
    }))
    .sort((a, b) => totalCost(b.costByCurrency) - totalCost(a.costByCurrency));
}

export type TickerAgg = {
  symbol: string;
  // The currency of the first lot ever bought for this symbol, across all accounts.
  // Real tickers are effectively single-currency (a US stock is bought in USD), so this
  // is treated as the position's native currency for avg cost / market value / P&L.
  currency: string;
  totalShares: number;
  closed: boolean;
  avgCost: number;
  avgAgeYears: number;
  costBasis: number;
  realizedPL: number;
  realizedCostBasis: number;
  perAccount: { account: string; shares: number; avgCost: number }[];
};

function daysSinceEpoch(iso: string) {
  return new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000;
}

// Portfolio-wide equivalent of computeOpenPositions: aggregates every (account, symbol)
// ledger across ALL accounts into one row per symbol, plus realized P&L and a
// weighted-average purchase age. Age uses the same average-cost trick as cost basis —
// a "date basis" (shares * dayNumber) shrinks proportionally on each sell, so the
// remaining weighted-average purchase date survives partial sells without tracking
// individual lots.
export function aggregateTickers(transactions: Transaction[]): TickerAgg[] {
  const byDateAsc = transactions
    .filter((tx) => tx.type === "buy" || tx.type === "sell")
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  type Ledger = {
    shares: number;
    costBasis: number;
    dateBasis: number;
    realizedPL: number;
    realizedCostBasis: number;
    currency: string;
  };
  const ledgers = new Map<string, Ledger>();

  for (const tx of byDateAsc) {
    const symbol = tx.symbol ?? "";
    const key = `${tx.account}|${symbol}`;
    const ledger =
      ledgers.get(key) ?? { shares: 0, costBasis: 0, dateBasis: 0, realizedPL: 0, realizedCostBasis: 0, currency: tx.currency };
    const shares = tx.shares ?? 0;
    const price = tx.pricePerShare ?? 0;
    const day = daysSinceEpoch(tx.date);
    if (tx.type === "buy") {
      ledger.costBasis += shares * price;
      ledger.dateBasis += shares * day;
      ledger.shares += shares;
    } else {
      const avgCost = ledger.shares > 0 ? ledger.costBasis / ledger.shares : 0;
      const avgDay = ledger.shares > 0 ? ledger.dateBasis / ledger.shares : day;
      const sellShares = Math.min(shares, ledger.shares);
      const costOfSold = avgCost * sellShares;
      ledger.costBasis -= costOfSold;
      ledger.dateBasis -= avgDay * sellShares;
      ledger.realizedPL += (price - avgCost) * sellShares;
      ledger.realizedCostBasis += costOfSold;
      ledger.shares -= sellShares;
    }
    ledgers.set(key, ledger);
  }

  type SymbolEntry = {
    shares: number;
    costBasis: number;
    dateBasis: number;
    realizedPL: number;
    realizedCostBasis: number;
    currency: string;
    perAccount: Map<string, { shares: number; costBasis: number }>;
  };
  const bySymbol = new Map<string, SymbolEntry>();

  for (const [key, ledger] of ledgers) {
    const [account, symbol] = key.split("|");
    const entry: SymbolEntry =
      bySymbol.get(symbol) ??
      { shares: 0, costBasis: 0, dateBasis: 0, realizedPL: 0, realizedCostBasis: 0, currency: ledger.currency, perAccount: new Map() };
    entry.shares += ledger.shares;
    entry.costBasis += ledger.costBasis;
    entry.dateBasis += ledger.dateBasis;
    entry.realizedPL += ledger.realizedPL;
    entry.realizedCostBasis += ledger.realizedCostBasis;
    if (ledger.shares > 1e-9) {
      const pa = entry.perAccount.get(account) ?? { shares: 0, costBasis: 0 };
      pa.shares += ledger.shares;
      pa.costBasis += ledger.costBasis;
      entry.perAccount.set(account, pa);
    }
    bySymbol.set(symbol, entry);
  }

  const today = Date.now() / 86_400_000;

  return [...bySymbol.entries()]
    .map(([symbol, e]) => {
      const closed = e.shares <= 1e-9;
      const avgCost = e.shares > 1e-9 ? e.costBasis / e.shares : 0;
      const avgAgeYears = e.shares > 1e-9 ? (today - e.dateBasis / e.shares) / 365.25 : 0;
      return {
        symbol,
        currency: e.currency,
        totalShares: closed ? 0 : e.shares,
        closed,
        avgCost,
        avgAgeYears,
        costBasis: e.costBasis,
        realizedPL: e.realizedPL,
        realizedCostBasis: e.realizedCostBasis,
        perAccount: [...e.perAccount.entries()]
          .map(([account, pa]) => ({
            account,
            shares: pa.shares,
            avgCost: pa.shares > 1e-9 ? pa.costBasis / pa.shares : 0,
          }))
          .sort((a, b) => b.shares - a.shares),
      };
    })
    .sort((a, b) => b.costBasis - a.costBasis);
}

// Average-cost realized P/L per (account, ticker) ledger, walked in date order,
// keyed by transaction id — same algorithm as aggregateTickers' realizedPL but
// broken out per-transaction so a ledger screen (Transactions, Asset Detail) can
// show the P&L of an individual Sell row. Unifies portifo-web's previously
// duplicated TransactionRow.computeRealizedPL into this single implementation.
export function computeRealizedPLByTransaction(transactions: Transaction[]): Map<string, number> {
  const byDateAsc = transactions
    .filter((tx) => tx.type === "buy" || tx.type === "sell")
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const ledgers = new Map<string, { shares: number; costBasis: number }>();
  const pl = new Map<string, number>();

  for (const tx of byDateAsc) {
    const key = `${tx.account}|${tx.symbol}`;
    const ledger = ledgers.get(key) ?? { shares: 0, costBasis: 0 };
    const shares = tx.shares ?? 0;
    const price = tx.pricePerShare ?? 0;
    if (tx.type === "buy") {
      ledger.costBasis += shares * price;
      ledger.shares += shares;
    } else {
      const avgCost = ledger.shares > 0 ? ledger.costBasis / ledger.shares : 0;
      const sellShares = Math.min(shares, ledger.shares);
      const costOfSold = avgCost * sellShares;
      const proceeds = sellShares * price;
      pl.set(tx.id, proceeds - costOfSold);
      ledger.costBasis -= costOfSold;
      ledger.shares -= sellShares;
    }
    ledgers.set(key, ledger);
  }

  return pl;
}
