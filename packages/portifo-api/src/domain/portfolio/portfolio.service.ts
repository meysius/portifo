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
  async getPortfolioValueHistory(portfolioId: string, range: HistoryRange, displayCurrency: string): Promise<HistoryPoint[]> {
    const accounts = await this.portfolioRepo.listAccountsByPortfolio(portfolioId);
    const transactionsByAccount = await Promise.all(
      accounts.map((account) => this.portfolioRepo.listTransactionsByAccount(account.id)),
    );
    const transactions = transactionsByAccount.flat().sort((a, b) => a.date.localeCompare(b.date));
    if (transactions.length === 0) return [];

    const tickers = [...new Set(transactions.filter((t) => t.ticker).map((t) => t.ticker as string))];

    // Anchor the chart's timestamp grid (and its granularity — 5m bars for 1D,
    // daily for 1Y, etc.) to one real price series. A cash-only portfolio has
    // no such series, so fall back to a synthetic daily grid.
    const gridSource = tickers.length > 0 ? await this.marketService.getHistory(tickers[0], range) : [];
    const grid = gridSource.length > 0 ? gridSource.map((p) => p.date) : this.syntheticDateGrid(range, transactions[0].date);

    const quotes = await this.marketService.getQuotes(tickers);
    const nativeCurrencyByTicker = new Map(quotes.map((q) => [q.symbol, q.currency]));

    const priceHistoryByTicker = new Map<string, HistoryPoint[]>([[tickers[0], gridSource]]);
    await Promise.all(
      tickers
        .slice(1)
        .map(async (ticker) => priceHistoryByTicker.set(ticker, await this.marketService.getHistory(ticker, range))),
    );

    const fxCurrencies = new Set(transactions.map((t) => t.currency));
    for (const ticker of tickers) fxCurrencies.add(nativeCurrencyByTicker.get(ticker) ?? displayCurrency);
    fxCurrencies.delete(displayCurrency);
    const fxHistoryByCurrency = new Map<string, HistoryPoint[]>();
    await Promise.all(
      [...fxCurrencies].map(async (currency) =>
        fxHistoryByCurrency.set(currency, await this.marketService.getFxHistory(currency, displayCurrency, range)),
      ),
    );

    const priceCursors = new Map<string, number>();
    const fxCursors = new Map<string, number>();
    const fxRateAt = (currency: string, timestamp: string): number => {
      if (currency === displayCurrency) return 1;
      const series = fxHistoryByCurrency.get(currency) ?? [];
      const idx = this.advanceCursor(series, timestamp, fxCursors.get(currency) ?? -1);
      fxCursors.set(currency, idx);
      return idx >= 0 ? series[idx].close : 1;
    };
    const priceAt = (ticker: string, timestamp: string): number | undefined => {
      const series = priceHistoryByTicker.get(ticker) ?? [];
      const idx = this.advanceCursor(series, timestamp, priceCursors.get(ticker) ?? -1);
      priceCursors.set(ticker, idx);
      return idx >= 0 ? series[idx].close : undefined;
    };

    let txIndex = 0;
    const sharesHeld = new Map<string, number>();
    const cashByCurrency = new Map<string, number>();

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
        } else {
          cashByCurrency.set(t.currency, (cashByCurrency.get(t.currency) ?? 0) + this.computeCashDelta(t));
        }
        txIndex++;
      }

      let value = 0;
      for (const [currency, amount] of cashByCurrency) {
        value += amount * fxRateAt(currency, timestamp);
      }
      for (const [ticker, shares] of sharesHeld) {
        if (Math.abs(shares) < 1e-9) continue;
        const price = priceAt(ticker, timestamp);
        if (price == null) continue;
        const nativeCurrency = nativeCurrencyByTicker.get(ticker) ?? displayCurrency;
        value += shares * price * fxRateAt(nativeCurrency, timestamp);
      }
      points.push({ date: timestamp, close: value });
    }

    return points;
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
