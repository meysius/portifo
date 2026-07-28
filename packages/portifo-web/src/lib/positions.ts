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
  realizedShares: number;
  // Share-weighted average holding period of the shares already sold, in years.
  // Only meaningful once something has been sold; it is what a fully-closed
  // position shows in place of the open position's avg age.
  realizedAgeYears: number;
  perAccount: AccountPosition[];
};

// One purchase, with the shares that survive to today. This app is average-cost
// (ACB), so a sale is a sale out of an undifferentiated pool — it is NOT drawn
// from the oldest lot as FIFO would. The ACB-native model is a PRO-RATA
// drawdown: selling 40 of 160 shares shrinks EVERY open lot by 25%. That keeps
// the display exact rather than approximate — the remaining lot costs still sum
// to the position's ACB cost basis, because removing the same fraction from
// every lot removes exactly that fraction of total basis. `pricePerShare` is
// the original purchase price and never moves; only `shares` shrinks.
export type Lot = {
  date: string;
  shares: number;
  pricePerShare: number;
  costBasis: number;
  ageYears: number;
};

export type AccountPosition = {
  account: string;
  shares: number;
  avgCost: number;
  costBasis: number;
  avgAgeYears: number;
  realizedPL: number;
  realizedCostBasis: number;
  realizedShares: number;
  realizedAgeYears: number;
  lots: Lot[];
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
    realizedShares: number;
    // Sum of (holding period in days x shares) for every sale — the realized
    // mirror of dateBasis, so avg hold survives partial sells the same way.
    realizedHoldDays: number;
    currency: string;
    // Open purchases, oldest first. Carried alongside the aggregate figures
    // rather than replacing them: the aggregates stay the single source of
    // truth and the lots are a pro-rata decomposition of them.
    lots: { date: string; shares: number; pricePerShare: number }[];
  };
  const ledgers = new Map<string, Ledger>();

  for (const tx of byDateAsc) {
    const symbol = tx.symbol ?? "";
    const key = `${tx.account}|${symbol}`;
    const ledger =
      ledgers.get(key) ??
      { shares: 0, costBasis: 0, dateBasis: 0, realizedPL: 0, realizedCostBasis: 0, realizedShares: 0, realizedHoldDays: 0, currency: tx.currency, lots: [] };
    const shares = tx.shares ?? 0;
    const price = tx.pricePerShare ?? 0;
    const day = daysSinceEpoch(tx.date);
    if (tx.type === "buy") {
      ledger.costBasis += shares * price;
      ledger.dateBasis += shares * day;
      ledger.shares += shares;
      ledger.lots.push({ date: tx.date, shares, pricePerShare: price });
    } else {
      const avgCost = ledger.shares > 0 ? ledger.costBasis / ledger.shares : 0;
      const avgDay = ledger.shares > 0 ? ledger.dateBasis / ledger.shares : day;
      const sellShares = Math.min(shares, ledger.shares);
      const costOfSold = avgCost * sellShares;
      ledger.costBasis -= costOfSold;
      ledger.dateBasis -= avgDay * sellShares;
      ledger.realizedPL += (price - avgCost) * sellShares;
      ledger.realizedCostBasis += costOfSold;
      ledger.realizedShares += sellShares;
      ledger.realizedHoldDays += (day - avgDay) * sellShares;
      // Pro-rata drawdown: the sale takes the same fraction out of every open
      // lot, which is what keeps the surviving lot costs summing to costBasis
      // above. Lots opened by a LATER buy are untouched by this sell because
      // transactions are walked in date order.
      const remaining = ledger.shares > 0 ? (ledger.shares - sellShares) / ledger.shares : 0;
      for (const lot of ledger.lots) lot.shares *= remaining;
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
    realizedShares: number;
    realizedHoldDays: number;
    currency: string;
    // Ledgers are keyed (account, symbol), so exactly one ledger per account —
    // nothing to accumulate, the ledger IS the account's position.
    perAccount: Map<string, Ledger>;
  };
  const bySymbol = new Map<string, SymbolEntry>();

  for (const [key, ledger] of ledgers) {
    const [account, symbol] = key.split("|");
    const entry: SymbolEntry =
      bySymbol.get(symbol) ??
      { shares: 0, costBasis: 0, dateBasis: 0, realizedPL: 0, realizedCostBasis: 0, realizedShares: 0, realizedHoldDays: 0, currency: ledger.currency, perAccount: new Map() };
    entry.shares += ledger.shares;
    entry.costBasis += ledger.costBasis;
    entry.dateBasis += ledger.dateBasis;
    entry.realizedPL += ledger.realizedPL;
    entry.realizedCostBasis += ledger.realizedCostBasis;
    entry.realizedShares += ledger.realizedShares;
    entry.realizedHoldDays += ledger.realizedHoldDays;
    // An account that has sold out entirely still belongs here — it holds no
    // shares but it does hold realized P&L, which the closed-position screen
    // breaks down per account. Callers that only want open holdings filter on
    // `shares`.
    if (ledger.shares > 1e-9 || ledger.realizedCostBasis > 1e-9) {
      entry.perAccount.set(account, ledger);
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
        realizedShares: e.realizedShares,
        realizedAgeYears: e.realizedShares > 1e-9 ? e.realizedHoldDays / e.realizedShares / 365.25 : 0,
        perAccount: [...e.perAccount.entries()]
          .map(([account, pa]) => ({
            account,
            shares: pa.shares > 1e-9 ? pa.shares : 0,
            avgCost: pa.shares > 1e-9 ? pa.costBasis / pa.shares : 0,
            costBasis: pa.costBasis,
            avgAgeYears: pa.shares > 1e-9 ? (today - pa.dateBasis / pa.shares) / 365.25 : 0,
            realizedPL: pa.realizedPL,
            realizedCostBasis: pa.realizedCostBasis,
            realizedShares: pa.realizedShares,
            realizedAgeYears: pa.realizedShares > 1e-9 ? pa.realizedHoldDays / pa.realizedShares / 365.25 : 0,
            lots: pa.lots
              .filter((l) => l.shares > 1e-9)
              .map((l) => ({
                date: l.date,
                shares: l.shares,
                pricePerShare: l.pricePerShare,
                costBasis: l.shares * l.pricePerShare,
                ageYears: (today - daysSinceEpoch(l.date)) / 365.25,
              })),
          }))
          .sort((a, b) => b.shares - a.shares || b.realizedPL - a.realizedPL),
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
