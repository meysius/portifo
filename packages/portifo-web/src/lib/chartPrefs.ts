import { useSyncExternalStore } from "react";

// The charts' toggles, kept per device like the appearance setting, and
// shared live: every chart on screen follows a flip at once.
export const SMA_BANDS_KEY = "portifo.chart.smaBands";
export const EARNINGS_KEY = "portifo.chart.earnings";
// Under a new name. The toggle's first version (Nov 4, removed the same
// evening) stored "portifo.chart.extendedHours", and nothing cleared it, so a
// device that turned it on then would come back with it on. Every device
// starts off instead, and the old entry goes.
export const EXTENDED_HOURS_KEY = "portifo.chart.extendedHoursOn";
try {
  localStorage.removeItem("portifo.chart.extendedHours");
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
