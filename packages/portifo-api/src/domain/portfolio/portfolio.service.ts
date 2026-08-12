import { SWLogger } from "simple-wire";
import { PortfolioRepo } from "./portfolio.repo";
import {
  AccountsSelect,
  AccountsInsert,
  CurrencyBalancesSelect,
  TransactionsSelect,
  TransactionsInsert,
  TransactionsUpdate,
} from "./portfolio.schema";
import { MarketService, HistoryRange, HistoryPoint } from "@/domain/market/market.service";

// The reconstructed value series, plus what could not be reconstructed from
// real market data. A ticker with no price series used to be dropped from the
// total and a missing fx rate used to be treated as par, so the curve came out
// LOWER than the portfolio total on the same screen with nothing to explain the
// gap. Both now fall back to the nearest available price/rate and say so here.
export type PortfolioValueHistory = {
  points: HistoryPoint[];
  estimatedTickers: string[];
  estimatedCurrencies: string[];
};

export class PortfolioService {
  constructor(
    private readonly logger: SWLogger,
    private readonly portfolioRepo: PortfolioRepo,
    private readonly marketService: MarketService,
  ) {}

  async createAccount(accountData: AccountsInsert): Promise<AccountsSelect> {
    return this.portfolioRepo.createAccount(accountData);
  }

  async getAccountById(id: string): Promise<AccountsSelect | undefined> {
    return this.portfolioRepo.getAccountById(id);
  }

  async listAccountsByPortfolio(portfolioId: string): Promise<AccountsSelect[]> {
    return this.portfolioRepo.listAccountsByPortfolio(portfolioId);
  }

  // Add Transaction lets the user type an existing or brand-new investment
  // account name in the same field, so the caller doesn't need to know which.
  async findOrCreateInvestmentAccount(portfolioId: string, name: string): Promise<AccountsSelect> {
    const existing = await this.portfolioRepo.listAccountsByPortfolio(portfolioId);
    const found = existing.find((account) => account.type === "investment" && account.name === name);
    if (found) return found;
    return this.portfolioRepo.createAccount({ portfolioId, name, type: "investment" });
  }

  async listCurrencyBalancesByAccount(accountId: string): Promise<CurrencyBalancesSelect[]> {
    return this.portfolioRepo.listCurrencyBalancesByAccount(accountId);
  }

  // The user only ever sees/edits the current balance, but under the hood each
  // edit is recorded as a deposit/withdraw transaction so total-value-over-time
  // can be reconstructed by replaying transactions across all accounts. These
  // transactions are filtered out of PortfolioController.listTransactions.
  async setCashAccountBalance(accountId: string, currency: string, balance: string): Promise<CurrencyBalancesSelect> {
    const account = await this.portfolioRepo.getAccountById(accountId);
    if (!account || account.type !== "cash") {
      throw new Error("setCashAccountBalance can only be used on a cash account");
    }

    const existing = await this.portfolioRepo.getCurrencyBalance(accountId, currency);
    const delta = Number(balance) - (existing ? Number(existing.balance) : 0);
    if (delta !== 0) {
      await this.portfolioRepo.createTransaction({
        accountId,
        type: delta > 0 ? "deposit" : "withdraw",
        date: new Date().toISOString().slice(0, 10),
        currency,
        amount: Math.abs(delta).toFixed(8),
      });
    }

    return this.portfolioRepo.upsertCurrencyBalance(accountId, currency, balance);
  }

  async getTransactionById(id: string): Promise<TransactionsSelect | undefined> {
    return this.portfolioRepo.getTransactionById(id);
  }

  async listTransactionsByAccount(accountId: string): Promise<TransactionsSelect[]> {
    return this.portfolioRepo.listTransactionsByAccount(accountId);
  }

  // Investment accounts only. Buy/Sell/Deposit/Withdraw all move the account's
  // cash currency_balance for the transaction's currency.
  async createTransaction(transactionData: TransactionsInsert): Promise<TransactionsSelect> {
    const account = await this.portfolioRepo.getAccountById(transactionData.accountId);
    if (!account || account.type !== "investment") {
      throw new Error("Transactions can only be created on an investment account");
    }

    const transaction = await this.portfolioRepo.createTransaction(transactionData);
    await this.applyCashDelta(transaction.accountId, transaction.currency, this.computeCashDelta(transaction));
    return transaction;
  }

  // Reverses the old transaction's cash effect (which may be on a different
  // account/currency than the edit lands on) before applying the new one.
  async updateTransaction(id: string, transactionData: TransactionsInsert): Promise<TransactionsSelect> {
    const existing = await this.portfolioRepo.getTransactionById(id);
    if (!existing) {
      throw new Error("Transaction not found");
    }

    const account = await this.portfolioRepo.getAccountById(transactionData.accountId);
    if (!account || account.type !== "investment") {
      throw new Error("Transactions can only be created on an investment account");
    }

    await this.applyCashDelta(existing.accountId, existing.currency, -this.computeCashDelta(existing));
    const updated = await this.portfolioRepo.updateTransaction(id, transactionData as TransactionsUpdate);
    await this.applyCashDelta(updated.accountId, updated.currency, this.computeCashDelta(updated));
    return updated;
  }

  async deleteTransaction(id: string): Promise<void> {
    const existing = await this.portfolioRepo.getTransactionById(id);
    if (!existing) return;

    await this.applyCashDelta(existing.accountId, existing.currency, -this.computeCashDelta(existing));
    await this.portfolioRepo.deleteTransaction(id);
  }

  private async applyCashDelta(accountId: string, currency: string, delta: number): Promise<void> {
    if (delta === 0) return;
    const existing = await this.portfolioRepo.getCurrencyBalance(accountId, currency);
    const newBalance = (existing ? Number(existing.balance) : 0) + delta;
    await this.portfolioRepo.upsertCurrencyBalance(accountId, currency, newBalance.toFixed(8));
  }

  private computeCashDelta(transaction: TransactionsSelect): number {
    switch (transaction.type) {
      case "deposit":
        return Number(transaction.amount);
      case "withdraw":
        return -Number(transaction.amount);
      case "sell":
        return Number(transaction.shares) * Number(transaction.pricePerShare);
      case "buy":
        return -Number(transaction.shares) * Number(transaction.pricePerShare);
    }
  }

  // Reconstructs total portfolio value (cash + holdings, converted to
  // displayCurrency) at each point across `range` by replaying every deposit/
  // withdraw/buy/sell transaction — including the hidden ones cash balance
  // edits generate — against historical prices/fx. Cash accounts have no
  // ledger UI, but they do have a ledger now (see setCashAccountBalance),
  // which is exactly what makes this reconstruction possible.
  //
  // This is a SECOND, independent computation of the figure the Portfolio hero
  // shows (which is stored balances + live quotes, computed client-side), so
  // the two agree only if this one can price everything. Where it cannot, it
  // now estimates and reports rather than silently omitting — see
  // PortfolioValueHistory. The remaining honest gap is that the last point is
  // the last CLOSE while the hero is the live quote.
  async getPortfolioValueHistory(
    portfolioId: string,
    range: HistoryRange,
    displayCurrency: string,
  ): Promise<PortfolioValueHistory> {
    const accounts = await this.portfolioRepo.listAccountsByPortfolio(portfolioId);
    const transactionsByAccount = await Promise.all(
      accounts.map((account) => this.portfolioRepo.listTransactionsByAccount(account.id)),
    );
    const transactions = transactionsByAccount.flat().sort((a, b) => a.date.localeCompare(b.date));
    if (transactions.length === 0) return { points: [], estimatedTickers: [], estimatedCurrencies: [] };

    const tickers = [...new Set(transactions.filter((t) => t.ticker).map((t) => t.ticker as string))];

    // ONE symbol the provider rejects must not take the whole chart down. It
    // used to: the provider throws on an unknown symbol, the rejection escaped
    // this method, and the controller turned it into a 502 — so a single
    // delisted or mistyped ticker replaced the entire curve with an error,
    // rather than costing only its own contribution. An empty series here
    // routes into the fallbacks below and is reported as estimated.
    const safeHistory = async (symbol: string): Promise<HistoryPoint[]> => {
      try {
        return await this.marketService.getHistory(symbol, range);
      } catch {
        return [];
      }
    };

    const priceHistoryByTicker = new Map<string, HistoryPoint[]>(
      await Promise.all(tickers.map(async (ticker): Promise<[string, HistoryPoint[]]> => [ticker, await safeHistory(ticker)])),
    );

    // Anchor the chart's timestamp grid (and its granularity — 5m bars for 1D,
    // daily for 1Y, etc.) to a real price series: the first ticker that HAS
    // one, not simply the first ticker — that distinction is what stops an
    // unpriceable symbol at the head of the ledger from flattening every other
    // holding onto a synthetic grid. A cash-only portfolio has no series at
    // all, and falls back to a synthetic daily one.
    const gridSource = tickers.map((t) => priceHistoryByTicker.get(t) ?? []).find((series) => series.length > 0) ?? [];
    const grid = gridSource.length > 0 ? gridSource.map((p) => p.date) : this.syntheticDateGrid(range, transactions[0].date);

    const quotes = await this.marketService.getQuotes(tickers).catch(() => []);
    const nativeCurrencyByTicker = new Map(quotes.map((q) => [q.symbol, q.currency]));
    const livePriceByTicker = new Map(quotes.map((q) => [q.symbol, q.price]));

    const fxCurrencies = new Set(transactions.map((t) => t.currency));
    for (const ticker of tickers) fxCurrencies.add(nativeCurrencyByTicker.get(ticker) ?? displayCurrency);
    fxCurrencies.delete(displayCurrency);
    const fxHistoryByCurrency = new Map<string, HistoryPoint[]>();
    await Promise.all(
      [...fxCurrencies].map(async (currency) =>
        // Same reasoning as safeHistory: an fx pair the provider has no series
        // for costs that currency its historical rate, not the whole chart.
        fxHistoryByCurrency.set(
          currency,
          await this.marketService.getFxHistory(currency, displayCurrency, range).catch(() => []),
        ),
      ),
    );

    // Live rates, as the fallback for a currency whose HISTORICAL series came
    // back empty. getFxRates(base, targets) is quoted as targets-per-1-base, so
    // asking with displayCurrency as the base and inverting gives what the
    // valuation below wants: displayCurrency per 1 unit of `currency`.
    const liveFxByCurrency = new Map<string, number>();
    if (fxCurrencies.size > 0) {
      try {
        const inverse = await this.marketService.getFxRates(displayCurrency, [...fxCurrencies]);
        for (const [currency, rate] of Object.entries(inverse)) {
          if (Number.isFinite(rate) && rate > 0) liveFxByCurrency.set(currency, 1 / rate);
        }
      } catch {
        // Leave the map empty — the callers below degrade to 1 and say so.
      }
    }

    // Anything valued by a fallback rather than by its own historical series.
    // Reported alongside the points so the chart can say the total is an
    // estimate, instead of quietly drawing a curve that is too low.
    const estimatedTickers = new Set<string>();
    const estimatedCurrencies = new Set<string>();

    const priceCursors = new Map<string, number>();
    const fxCursors = new Map<string, number>();
    // A missing rate used to return 1, which does not mean "unknown" — it means
    // "this currency is at par with the display currency", and it silently
    // undervalued every foreign balance. Back-fill from the start of the series
    // for timestamps that precede it, fall back to the live rate when there is
    // no series at all, and only then give up (flagging it either way).
    const fxRateAt = (currency: string, timestamp: string): number => {
      if (currency === displayCurrency) return 1;
      const series = fxHistoryByCurrency.get(currency) ?? [];
      if (series.length === 0) {
        const live = liveFxByCurrency.get(currency);
        estimatedCurrencies.add(currency);
        return live ?? 1;
      }
      const idx = this.advanceCursor(series, timestamp, fxCursors.get(currency) ?? -1);
      fxCursors.set(currency, idx);
      // Before the series starts: its first close is the nearest real rate.
      if (idx < 0) {
        estimatedCurrencies.add(currency);
        return series[0].close;
      }
      return series[idx].close;
    };
    // Same failure, worse consequence: a ticker with no series contributed
    // NOTHING to any point, so a real holding vanished from the chart while
    // still counting in the portfolio total on the same screen. `lastLedger`
    // is the most recent price the ledger itself has seen for the ticker, which
    // is the only price available for a symbol the market data does not know.
    const priceAt = (ticker: string, timestamp: string, lastLedger: number | undefined): number | undefined => {
      const series = priceHistoryByTicker.get(ticker) ?? [];
      if (series.length === 0) {
        const fallback = livePriceByTicker.get(ticker) ?? lastLedger;
        if (fallback == null) return undefined;
        estimatedTickers.add(ticker);
        return fallback;
      }
      const idx = this.advanceCursor(series, timestamp, priceCursors.get(ticker) ?? -1);
      priceCursors.set(ticker, idx);
      if (idx < 0) {
        estimatedTickers.add(ticker);
        return series[0].close;
      }
      return series[idx].close;
    };

    let txIndex = 0;
    const sharesHeld = new Map<string, number>();
    const cashByCurrency = new Map<string, number>();
    // Last price the LEDGER has seen for a ticker, filled in as the replay
    // walks past each buy/sell. The last-resort price for a symbol the market
    // data provider does not recognise.
    const ledgerPriceByTicker = new Map<string, number>();

    const points: HistoryPoint[] = [];
    for (const timestamp of grid) {
      // Ledger dates carry no time-of-day, so a transaction is considered
      // "applied" for every grid point from the start of its date onward.
      const day = timestamp.slice(0, 10);
      while (txIndex < transactions.length && transactions[txIndex].date <= day) {
        const t = transactions[txIndex];
        if (t.ticker) {
          const shares = Number(t.shares) * (t.type === "sell" ? -1 : 1);
          sharesHeld.set(t.ticker, (sharesHeld.get(t.ticker) ?? 0) + shares);
          const paid = Number(t.pricePerShare);
          if (Number.isFinite(paid) && paid > 0) ledgerPriceByTicker.set(t.ticker, paid);
        }
        // Every transaction moves cash, buys and sells included — the same
        // delta applyCashDelta writes to currency_balances live. Skipping it
        // for ticker rows would leave a buy's deposit sitting in cash while
        // the shares it bought are also valued, double-counting it.
        cashByCurrency.set(t.currency, (cashByCurrency.get(t.currency) ?? 0) + this.computeCashDelta(t));
        txIndex++;
      }

      let value = 0;
      for (const [currency, amount] of cashByCurrency) {
        value += amount * fxRateAt(currency, timestamp);
      }
      for (const [ticker, shares] of sharesHeld) {
        if (Math.abs(shares) < 1e-9) continue;
        const price = priceAt(ticker, timestamp, ledgerPriceByTicker.get(ticker));
        // Only when the symbol has no series, no quote and no ledger price —
        // i.e. genuinely nothing to value it with. It is still reported.
        if (price == null) {
          estimatedTickers.add(ticker);
          continue;
        }
        const nativeCurrency = nativeCurrencyByTicker.get(ticker) ?? displayCurrency;
        value += shares * price * fxRateAt(nativeCurrency, timestamp);
      }
      points.push({ date: timestamp, close: value });
    }

    return {
      points,
      estimatedTickers: [...estimatedTickers],
      estimatedCurrencies: [...estimatedCurrencies],
    };
  }

  // `series` is sorted ascending by date; advances `from` to the last index
  // whose date is <= `timestamp` (carry-forward), or -1 if `timestamp`
  // precedes all of it.
  private advanceCursor(series: HistoryPoint[], timestamp: string, from: number): number {
    if (series.length === 0) return -1;
    let i = from;
    if (i < 0) {
      if (series[0].date > timestamp) return -1;
      i = 0;
    }
    while (i + 1 < series.length && series[i + 1].date <= timestamp) i++;
    return i;
  }

  // Cash-only portfolios have no price series to anchor a grid to, so build a
  // plain daily one instead. Each day is stamped at end-of-day so it still
  // carries forward through that day's intraday fx ticks (see advanceCursor).
  private syntheticDateGrid(range: HistoryRange, earliestTransactionDate: string): string[] {
    const end = new Date();
    const start = new Date(end);
    switch (range) {
      case "1D":
        start.setDate(start.getDate() - 1);
        break;
      case "1W":
        start.setDate(start.getDate() - 7);
        break;
      case "1M":
        start.setMonth(start.getMonth() - 1);
        break;
      case "3M":
        start.setMonth(start.getMonth() - 3);
        break;
      case "6M":
        start.setMonth(start.getMonth() - 6);
        break;
      case "1Y":
        start.setFullYear(start.getFullYear() - 1);
        break;
      case "2Y":
        start.setFullYear(start.getFullYear() - 2);
        break;
      case "5Y":
        start.setFullYear(start.getFullYear() - 5);
        break;
      case "All":
        start.setFullYear(start.getFullYear() - 100);
        break;
    }

    const earliest = new Date(earliestTransactionDate);
    const cursor = start > earliest ? start : earliest;
    cursor.setUTCHours(0, 0, 0, 0);

    const dates: string[] = [];
    while (cursor <= end) {
      dates.push(new Date(cursor.getTime() + (24 * 60 * 60 * 1000 - 1)).toISOString());
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }
}
