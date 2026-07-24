import { apiFetch } from "./http";

export type TransactionType = "buy" | "sell" | "deposit" | "withdraw";

export interface Transaction {
  id: string;
  type: TransactionType;
  account: string;
  date: string;
  currency: string;
  amount?: number;
  symbol?: string;
  shares?: number;
  pricePerShare?: number;
  notes?: string;
}

export async function listTransactions(): Promise<Transaction[]> {
  const res = await apiFetch("/transactions");
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}
