import { useSyncExternalStore } from "react";
import { CURRENCIES } from "./currencies";

// The currency every converted figure is shown in. One app-wide preference
// rather than a chip per screen: picking CAD on Portfolio and then pushing
// Cash or an account must not silently flip the figures back to USD. Kept
// per device, like the appearance setting.

const STORAGE_KEY = "portifo.displayCurrency";
const listeners = new Set<() => void>();

function readStored(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && CURRENCIES.some((c) => c.code === v)) return v;
  } catch {
    // Storage blocked — fall through to the default.
  }
  return "USD";
}

let current = readStored();

export function setDisplayCurrency(code: string) {
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Still applies for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDisplayCurrency(): [string, (code: string) => void] {
  const value = useSyncExternalStore(subscribe, () => current);
  return [value, setDisplayCurrency];
}
