import { apiFetch } from "./http";

// The watchlist belongs to the signed-in user, not to the active portfolio,
// so these calls ignore X-Portfolio-Id. Oldest first: a new symbol joins the
// bottom.
export type WatchlistItem = { symbol: string; addedAt: string };

export async function listWatchlist(): Promise<WatchlistItem[]> {
  const res = await apiFetch("/watchlist");
  if (!res.ok) throw new Error("Failed to load watchlist");
  return res.json();
}

// Adding a symbol that's already on the list is a no-op that returns it.
export async function addToWatchlist(symbol: string): Promise<WatchlistItem> {
  const res = await apiFetch("/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to add to watchlist");
  }
  return res.json();
}

export async function removeFromWatchlist(symbol: string): Promise<void> {
  const res = await apiFetch(`/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove from watchlist");
}
