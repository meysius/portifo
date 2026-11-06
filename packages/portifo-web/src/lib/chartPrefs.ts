import { useSyncExternalStore } from "react";

// The charts' toggles, kept per device like the appearance setting, and
// shared live: every chart on screen follows a flip at once.
export const SMA_BANDS_KEY = "portifo.chart.smaBands";
export const EARNINGS_KEY = "portifo.chart.earnings";
// Extended hours was a toggle until Nov 6, kept under these names (the
// second after its first version, Nov 4). 1D now always draws them, so the
// old entries go.
try {
  localStorage.removeItem("portifo.chart.extendedHours");
  localStorage.removeItem("portifo.chart.extendedHoursOn");
} catch {
  // No storage: nothing was kept.
}

const listeners = new Set<() => void>();
// Where storage is refused (a private window), a flip still holds until the
// page reloads.
const memory = new Map<string, boolean>();

function read(key: string) {
  if (memory.has(key)) return memory.get(key) as boolean;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Off unless turned on.
export function useChartPref(key: string): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => read(key));
  const set = (next: boolean) => {
    memory.set(key, next);
    try {
      if (next) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch {
      // Held in memory instead.
    }
    listeners.forEach((l) => l());
  };
  return [on, set];
}
