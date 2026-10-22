import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { addToWatchlist, listWatchlist, removeFromWatchlist } from "../api/watchlist";
import { useToast } from "./ToastContext";

// The signed-in user's watchlist, shared by the Watchlist tab's pages so a
// symbol added or removed on a symbol's page is already right on the list
// behind it. A change applies at once and goes back if the server refuses it.

type WatchlistContextValue = {
  /** Null until the first load answers, so an empty list isn't claimed early. */
  symbols: string[] | null;
  loadFailed: boolean;
  /** Company names from search, shown until the symbol's quote brings its own. */
  names: Record<string, string>;
  reload(): Promise<string[] | null>;
  add(symbol: string, name?: string): void;
  remove(symbol: string): void;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [symbols, setSymbols] = useState<string[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;
  // Symbols with an add or remove still in flight; a second tap waits for it.
  const pending = useRef(new Set<string>());

  const reload = useCallback(async () => {
    try {
      const list = (await listWatchlist()).map((i) => i.symbol);
      setSymbols(list);
      setLoadFailed(false);
      return list;
    } catch {
      setLoadFailed(true);
      return null;
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = useCallback(
    async (symbol: string, name?: string) => {
      if (pending.current.has(symbol) || symbolsRef.current?.includes(symbol)) return;
      if (name) setNames((n) => ({ ...n, [symbol]: name }));
      pending.current.add(symbol);
      setSymbols((s) => [...(s ?? []), symbol]);
      try {
        await addToWatchlist(symbol);
      } catch {
        setSymbols((s) => s?.filter((x) => x !== symbol) ?? s);
        showToast(`Couldn’t add ${symbol}. Try again.`, { color: "danger" });
      } finally {
        pending.current.delete(symbol);
      }
    },
    [showToast],
  );

  const remove = useCallback(
    async (symbol: string) => {
      const at = symbolsRef.current?.indexOf(symbol) ?? -1;
      if (pending.current.has(symbol) || at < 0) return;
      pending.current.add(symbol);
      setSymbols((s) => s?.filter((x) => x !== symbol) ?? s);
      try {
        await removeFromWatchlist(symbol);
      } catch {
        setSymbols((s) => (s ? [...s.slice(0, at), symbol, ...s.slice(at)] : s));
        showToast(`Couldn’t remove ${symbol}. Try again.`, { color: "danger" });
      } finally {
        pending.current.delete(symbol);
      }
    },
    [showToast],
  );

  return (
    <WatchlistContext.Provider value={{ symbols, loadFailed, names, reload, add, remove }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used inside a WatchlistProvider");
  return ctx;
}
