import { z } from "zod";
import { date, numeric, pgEnum, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { portfolios } from "@/domain/identity/identity.schema";

export const accountTypeEnum = pgEnum("account_type", ["investment", "cash"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["buy", "sell", "deposit", "withdraw"]);

export const accounts = pgTable("accounts", {
  id: uuid().primaryKey().defaultRandom(),
  portfolioId: uuid()
    .notNull()
    .references(() => portfolios.id, { onDelete: "cascade" }),
  name: varchar({ length: 255 }).notNull(),
  type: accountTypeEnum().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const currencyBalances = pgTable(
  "currency_balances",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    currency: varchar({ length: 3 }).notNull(),
    balance: numeric({ precision: 20, scale: 8 }).notNull().default("0"),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [unique().on(table.accountId, table.currency)],
);

export const transactions = pgTable("transactions", {
  id: uuid().primaryKey().defaultRandom(),
  accountId: uuid()
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  type: transactionTypeEnum().notNull(),
  date: date().notNull(),
  currency: varchar({ length: 3 }).notNull(),
  // Deposit / Withdraw only
  amount: numeric({ precision: 20, scale: 8 }),
  // Buy / Sell only
  ticker: varchar({ length: 20 }),
  shares: numeric({ precision: 20, scale: 8 }),
  pricePerShare: numeric({ precision: 20, scale: 8 }),
  notes: text(),
  createdAt: timestamp().notNull().defaultNow(),
});

const AccountsSelectSchema = createSelectSchema(accounts);
const AccountsInsertSchema = createInsertSchema(accounts);
const AccountsUpdateSchema = createUpdateSchema(accounts);

export type AccountsSelect = z.infer<typeof AccountsSelectSchema>;
export type AccountsInsert = z.infer<typeof AccountsInsertSchema>;
export type AccountsUpdate = z.infer<typeof AccountsUpdateSchema>;

const CurrencyBalancesSelectSchema = createSelectSchema(currencyBalances);
const CurrencyBalancesInsertSchema = createInsertSchema(currencyBalances);
const CurrencyBalancesUpdateSchema = createUpdateSchema(currencyBalances);

export type CurrencyBalancesSelect = z.infer<typeof CurrencyBalancesSelectSchema>;
export type CurrencyBalancesInsert = z.infer<typeof CurrencyBalancesInsertSchema>;
export type CurrencyBalancesUpdate = z.infer<typeof CurrencyBalancesUpdateSchema>;

const TransactionsSelectSchema = createSelectSchema(transactions);
const TransactionsInsertSchema = createInsertSchema(transactions);
const TransactionsUpdateSchema = createUpdateSchema(transactions);

export type TransactionsSelect = z.infer<typeof TransactionsSelectSchema>;
export type TransactionsInsert = z.infer<typeof TransactionsInsertSchema>;
export type TransactionsUpdate = z.infer<typeof TransactionsUpdateSchema>;
