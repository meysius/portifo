import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useHistory } from "react-router-dom";
import { createAlert, deleteAlert, listAlerts, updateAlert } from "../api/alerts";
import type { AlertInput, PriceAlert } from "../api/alerts";
import { checkPushStatus, enablePushNotifications } from "../lib/push";
import type { PushStatus } from "../lib/push";

// The signed-in user's price alerts, shared by the Watchlist tab's pages: a
// symbol's page edits them and the list marks the symbols that have one. A
// change waits for the server, because the sheet making it stays open to show
// an error; a failed call rejects for it to catch.

type AlertsContextValue = {
  /** Null until the first load answers. */
  alerts: PriceAlert[] | null;
  /** Whether an alert could reach this device. */
  pushStatus: PushStatus;
  reload(): Promise<void>;
  create(symbol: string, input: AlertInput): Promise<void>;
  update(id: string, input: AlertInput): Promise<void>;
  remove(id: string): Promise<void>;
  /** Must run from a tap: iOS ignores the permission request anywhere else. */
  enableNotifications(): Promise<void>;
};

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const history = useHistory();
  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null);
  // Assumed fine until checked, so a warning doesn't flash on every launch.
  const [pushStatus, setPushStatus] = useState<PushStatus>("on");

  const reload = useCallback(async () => {
    try {
      setAlerts(await listAlerts());
    } catch {
      // Keeps what's on screen; the next page visit or pull tries again.
    }
  }, []);

  useEffect(() => {
    reload();
    checkPushStatus().then(setPushStatus);
  }, [reload]);

  // A tapped notification, with the app already open: the service worker can't
  // route the app itself, so it asks the page to. Replacing rather than pushing
  // leaves nothing behind the page, so its Back goes to the Watchlist it names
  // instead of whichever tab the app happened to be on.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== "open-url") return;
      reload();
      if (history.location.pathname !== e.data.url) history.replace(e.data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [history, reload]);

  const create = useCallback(async (symbol: string, input: AlertInput) => {
    const alert = await createAlert(symbol, input);
    setAlerts((list) => [...(list ?? []), alert]);
  }, []);

  const update = useCallback(async (id: string, input: AlertInput) => {
    const alert = await updateAlert(id, input);
    setAlerts((list) => list?.map((a) => (a.id === id ? alert : a)) ?? list);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteAlert(id);
    setAlerts((list) => list?.filter((a) => a.id !== id) ?? list);
  }, []);

  const enableNotifications = useCallback(async () => {
    await enablePushNotifications().catch(() => {});
    setPushStatus(await checkPushStatus());
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts, pushStatus, reload, create, update, remove, enableNotifications }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used inside an AlertsProvider");
  return ctx;
}
