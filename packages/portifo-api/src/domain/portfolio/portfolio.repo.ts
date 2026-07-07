import { eq, and } from "drizzle-orm";
import { DrizzleDb } from "@/setup/db";
import {
  accounts,
  currencyBalances,
  transactions,
  AccountsInsert,
  AccountsSelect,
  CurrencyBalancesSelect,
  TransactionsInsert,
  TransactionsSelect,
  TransactionsUpdate,
} from "./portfolio.schema";

export interface PortfolioRepo {
  createAccount(accountData: AccountsInsert): Promise<AccountsSelect>;
  getAccountById(id: string): Promise<AccountsSelect | undefined>;
  listAccountsByPortfolio(portfolioId: string): Promise<AccountsSelect[]>;

  getCurrencyBalance(accountId: string, currency: string): Promise<CurrencyBalancesSelect | undefined>;
  listCurrencyBalancesByAccount(accountId: string): Promise<CurrencyBalancesSelect[]>;
  upsertCurrencyBalance(accountId: string, currency: string, balance: string): Promise<CurrencyBalancesSelect>;

  createTransaction(transactionData: TransactionsInsert): Promise<TransactionsSelect>;
  getTransactionById(id: string): Promise<TransactionsSelect | undefined>;
  listTransactionsByAccount(accountId: string): Promise<TransactionsSelect[]>;
  updateTransaction(id: string, transactionData: TransactionsUpdate): Promise<TransactionsSelect>;
  deleteTransaction(id: string): Promise<void>;
}

export class DrizzlePortfolioRepo implements PortfolioRepo {
  constructor(private readonly db: DrizzleDb) {}

  async createAccount(accountData: AccountsInsert): Promise<AccountsSelect> {
    const result = await this.db.insert(accounts).values(accountData).returning();
    return result[0];
  }

  async getAccountById(id: string): Promise<AccountsSelect | undefined> {
    const result = await this.db.select().from(accounts).where(eq(accounts.id, id));
    return result[0];
  }

  async listAccountsByPortfolio(portfolioId: string): Promise<AccountsSelect[]> {
    return this.db.select().from(accounts).where(eq(accounts.portfolioId, portfolioId));
  }

  async getCurrencyBalance(accountId: string, currency: string): Promise<CurrencyBalancesSelect | undefined> {
    const result = await this.db
      .select()
      .from(currencyBalances)
      .where(and(eq(currencyBalances.accountId, accountId), eq(currencyBalances.currency, currency)));
    return result[0];
  }

  async listCurrencyBalancesByAccount(accountId: string): Promise<CurrencyBalancesSelect[]> {
    return this.db.select().from(currencyBalances).where(eq(currencyBalances.accountId, accountId));
  }

  async upsertCurrencyBalance(accountId: string, currency: string, balance: string): Promise<CurrencyBalancesSelect> {
    const result = await this.db
      .insert(currencyBalances)
      .values({ accountId, currency, balance })
      .onConflictDoUpdate({
        target: [currencyBalances.accountId, currencyBalances.currency],
        set: { balance, updatedAt: new Date() },
      })
      .returning();
    return result[0];
  }

  async createTransaction(transactionData: TransactionsInsert): Promise<TransactionsSelect> {
    const result = await this.db.insert(transactions).values(transactionData).returning();
    return result[0];
  }

  async getTransactionById(id: string): Promise<TransactionsSelect | undefined> {
    const result = await this.db.select().from(transactions).where(eq(transactions.id, id));
    return result[0];
  }

  async listTransactionsByAccount(accountId: string): Promise<TransactionsSelect[]> {
    return this.db.select().from(transactions).where(eq(transactions.accountId, accountId));
  }

  async updateTransaction(id: string, transactionData: TransactionsUpdate): Promise<TransactionsSelect> {
    const result = await this.db.update(transactions).set(transactionData).where(eq(transactions.id, id)).returning();
    return result[0];
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.db.delete(transactions).where(eq(transactions.id, id));
  }
}
