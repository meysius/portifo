import { App, Views, View, Toolbar, Link, Icon, useStore } from "framework7-react";

import routes from "./routes.ts";
import { store } from "./store.ts";
import { HoldingsIcon, TransactionsIcon, AccountsIcon, SettingsIcon } from "./components/TabIcons.tsx";

export default function PortifoApp() {
  return (
    // Forced iOS theme regardless of host platform, matching portifo-web's
    // native-iOS-feel PWA convention.
    <App theme="ios" name="Portifo F7" routes={routes}>
      <AppShell />
    </App>
  );
}

// The tab Views are always mounted — never conditionally swapped for a
// Login/Onboarding View — since tearing down and recreating Framework7
// Views mid-lifecycle leaves orphaned page DOM behind (see Root.tsx for
// why). Only the tab bar itself, a plain leaf component with no router
// state of its own, is safe to show/hide based on auth + onboarding status;
// the actual gating happens inside RootPage's single stable <Page>.
function AppShell() {
  const authStatus = useStore(store, "authStatus") as "loading" | "unauthenticated" | "authenticated";
  const hasBothAccountTypes = useStore(store, "hasBothAccountTypes") as boolean;
  const showTabbar = authStatus === "authenticated" && hasBothAccountTypes;

  return (
    <Views tabs className="safe-areas">
      {showTabbar && (
        <Toolbar tabbar bottom icons>
          <Link tabLink="#view-holdings" tabLinkActive>
            <Icon>
              <HoldingsIcon />
            </Icon>
            <span className="tabbar-label">Holdings</span>
          </Link>
          <Link tabLink="#view-transactions">
            <Icon>
              <TransactionsIcon />
            </Icon>
            <span className="tabbar-label">Transactions</span>
          </Link>
          <Link tabLink="#view-accounts">
            <Icon>
              <AccountsIcon />
            </Icon>
            <span className="tabbar-label">Accounts</span>
          </Link>
          <Link tabLink="#view-settings">
            <Icon>
              <SettingsIcon />
            </Icon>
            <span className="tabbar-label">Settings</span>
          </Link>
        </Toolbar>
      )}

      <View id="view-holdings" main tab tabActive url="/" />
      <View id="view-transactions" tab url="/transactions/" />
      <View id="view-accounts" tab url="/accounts/" />
      <View id="view-settings" tab url="/settings/" />
    </Views>
  );
}
