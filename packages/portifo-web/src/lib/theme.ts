import { useSyncExternalStore } from "react";

// Theme controller for the manual appearance setting. Ionic's palette is
// class-based (palettes/dark.class.css): dark applies when <html> carries
// `ion-palette-dark`, light when it doesn't. "system" resolves against
// prefers-color-scheme here in JS and tracks OS changes live.

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "portifo.theme";

// theme-color paints the iOS status bar (index.html sets the "default" style),
// so it must be the page ground: --ds-bg, read from the token so it cannot
// drift. These fallbacks match it and the first-paint metas in index.html.
const DARK_BG = "#121820";
const LIGHT_BG = "#FFFFFF";

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function readStored(): ThemePreference {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

let preference: ThemePreference = readStored();

let resolvedDark = false;

function apply() {
  resolvedDark = preference === "dark" || (preference === "system" && prefersDark.matches);
  document.documentElement.classList.toggle("ion-palette-dark", resolvedDark);
  const bg =
    getComputedStyle(document.documentElement).getPropertyValue("--ds-bg").trim() ||
    (resolvedDark ? DARK_BG : LIGHT_BG);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}

prefersDark.addEventListener("change", () => {
  if (preference === "system") {
    apply();
    listeners.forEach((l) => l());
  }
});

/* Applies the stored preference; called once in main.tsx before render. */
export function initTheme() {
  apply();
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  if (next === "system") localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, next);
  apply();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference);
}

/* The light/dark the app is actually showing (preference with "system"
   resolved) — for JS that snapshots CSS var colors and must recompute when
   the ground shifts (e.g. PriceChart). */
export function useResolvedDark(): boolean {
  return useSyncExternalStore(subscribe, () => resolvedDark);
}
