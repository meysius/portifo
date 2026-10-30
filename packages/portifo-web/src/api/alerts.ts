import { apiFetch } from "./http";

// Price alerts belong to the signed-in user, like the watchlist, so these
// calls ignore X-Portfolio-Id. Oldest first.
export type AlertDirection = "below" | "above";

export type AlertInput = {
  direction: AlertDirection;
  // Per share, in the symbol's own currency.
  price: number;
};

export type PriceAlert = AlertInput & {
  id: string;
  symbol: string;
  // When it went off and the price that set it off; null while it's still on.
  triggeredAt: string | null;
  triggeredPrice: number | null;
};

const jsonBody = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function listAlerts(): Promise<PriceAlert[]> {
  const res = await apiFetch("/alerts");
  if (!res.ok) throw new Error("Failed to load alerts");
  return res.json();
}

export async function createAlert(symbol: string, input: AlertInput): Promise<PriceAlert> {
  const res = await apiFetch("/alerts", { method: "POST", ...jsonBody({ symbol, ...input }) });
  if (!res.ok) throw new Error("Failed to create alert");
  return res.json();
}

// Saving starts a rule over, so this also turns back on one that has fired.
export async function updateAlert(id: string, input: AlertInput): Promise<PriceAlert> {
  const res = await apiFetch(`/alerts/${id}`, { method: "PATCH", ...jsonBody(input) });
  if (!res.ok) throw new Error("Failed to update alert");
  return res.json();
}

export async function deleteAlert(id: string): Promise<void> {
  const res = await apiFetch(`/alerts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete alert");
}
