import { apiFetch } from "./http";

// Price alerts belong to the signed-in user, like the watchlist, so these
// calls ignore X-Portfolio-Id. Oldest first.
// "both" fires on a cross either way, and is what a new rule starts as.
export type AlertDirection = "both" | "below" | "above";

// "once" goes off when the price crosses a target, then stops. "live" goes
// off each time it crosses another multiple of a step ($2: 190, 192, 194...).
export type AlertMode = "once" | "live";

export type AlertInput = {
  mode: AlertMode;
  direction: AlertDirection;
  // Per share, in the symbol's own currency: a "once" rule's target, a "live"
  // rule's step.
  price: number;
};

export type PriceAlert = AlertInput & {
  id: string;
  symbol: string;
  // When it went off and the price that set it off: the end of a "once" rule,
  // the latest time for a "live" one. Null until then.
  triggeredAt: string | null;
  triggeredPrice: number | null;
};

// Still watching: a "once" rule stops when it goes off.
export const isOn = (a: PriceAlert) => a.mode === "live" || !a.triggeredAt;

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
