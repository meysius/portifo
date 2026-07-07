import { apiFetch } from "./http";
import type { HistoryPoint, HistoryRange } from "./market";

export interface PortfolioDto {
  id: string;
  name: string;
}

export async function listPortfolios(): Promise<PortfolioDto[]> {
  const res = await apiFetch("/portfolios");
  if (!res.ok) throw new Error("Failed to fetch portfolios");
  return res.json();
}

export async function createPortfolio(name: string): Promise<PortfolioDto> {
  const res = await apiFetch("/portfolios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to create portfolio");
  }
  return res.json();
}

export interface AccountDto {
  id: string;
  name: string;
  type: "investment" | "cash";
  balances: { currency: string; balance: number; asOf: string }[];
}

export type NewAccount = {
  name: string;
  type: "investment" | "cash";
};

export type TransactionType = "buy" | "sell" | "deposit" | "withdraw";

// Accounts are referenced by NAME, not id — the backend auto-creates a new
// investment account if the name doesn't exist yet (findOrCreateInvestmentAccount).
export type NewTransaction = {
  type: TransactionType;
  account: string;
  date: string;
  currency: string;
  amount?: number;
  symbol?: string;
  shares?: number;
  pricePerShare?: number;
  notes?: string;
};

export type Transaction = NewTransaction & { id: string };

export async function listAccounts(): Promise<AccountDto[]> {
  const res = await apiFetch("/accounts");
  if (!res.ok) throw new Error("Failed to fetch accounts");
  return res.json();
}

export async function createAccount(input: NewAccount): Promise<AccountDto> {
  const res = await apiFetch("/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create account");
  return res.json();
}

export async function updateCashBalance(accountId: string, currency: string, balance: number): Promise<AccountDto> {
  const res = await apiFetch(`/accounts/${accountId}/balances/${currency}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ balance }),
  });
  if (!res.ok) throw new Error("Failed to update balance");
  return res.json();
}

export async function getPortfolioHistory(range: HistoryRange, currency: string): Promise<HistoryPoint[]> {
  const res = await apiFetch(
    `/portfolio/history?range=${encodeURIComponent(range)}&currency=${encodeURIComponent(currency)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch portfolio history");
  return res.json();
}

export async function listTransactions(): Promise<Transaction[]> {
  const res = await apiFetch("/transactions");
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

export async function createTransaction(input: NewTransaction): Promise<Transaction> {
  const res = await apiFetch("/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create transaction");
  return res.json();
}

export async function updateTransaction(id: string, input: NewTransaction): Promise<Transaction> {
  const res = await apiFetch(`/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update transaction");
  return res.json();
}

export async function deleteTransaction(id: string): Promise<void> {
  const res = await apiFetch(`/transactions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete transaction");
}
