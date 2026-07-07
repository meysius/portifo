import { createContext, useContext } from "react";
import type { ReactNode } from "react";

// Ionic keeps each nested IonRouterOutlet's visibility in sync with the
// *current URL*, not with its parent transition's progress — a route pushed
// outside a tab's own outlet (e.g. the old flat /asset/:symbol) stays
// display:none the whole time you're swiping back into the tab, only
// popping visible once the URL actually lands. Nesting every tab-reachable
// detail route inside that tab's own outlet (Tabs.tsx) fixes it, but several
// of those routes (asset, account, cash-account, update-balance,
// add-transaction) are reachable from more than one tab, so the same page
// component is registered at more than one URL prefix. This context tells a
// shared page component which prefix it's currently mounted under, so it can
// build further pushes/back-button hrefs without hardcoding a single tab.
interface TabBaseValue {
  tabBase: string;
  tabLabel: string;
}

const TabBaseContext = createContext<TabBaseValue | null>(null);

export function TabBaseProvider({ tabBase, tabLabel, children }: TabBaseValue & { children: ReactNode }) {
  return <TabBaseContext.Provider value={{ tabBase, tabLabel }}>{children}</TabBaseContext.Provider>;
}

export function useTabBase(): TabBaseValue {
  const ctx = useContext(TabBaseContext);
  if (!ctx) throw new Error("useTabBase must be used within a TabBaseProvider");
  return ctx;
}
