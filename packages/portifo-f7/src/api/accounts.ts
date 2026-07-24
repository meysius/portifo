import { apiFetch } from "./http";

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
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to create account");
  }
  return res.json();
}
