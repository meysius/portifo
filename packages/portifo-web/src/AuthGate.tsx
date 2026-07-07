import { IonRouterOutlet, IonSpinner } from "@ionic/react";
import { Redirect, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { PortfolioDataProvider, usePortfolioData } from "./context/PortfolioDataContext";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import Tabs from "./Tabs";

// The whole app's route guard: while resolving the session, render nothing
// but a spinner; unauthenticated renders LoginPage directly (no router
// needed for a single screen); authenticated mounts the data layer and the
// real route table. Pushed detail screens (asset/account/cash-account/
// update-balance/add-transaction/transaction/cash) live inside whichever
// tab's own nested outlet pushed them (see Tabs.tsx) rather than at this top
// level — Ionic keeps a nested outlet's visibility in sync with the current
// URL, not with an ancestor outlet's in-progress swipe transition, so a
// route pushed here would render full-screen but stay blank for the whole
// swipe-back-into-a-tab gesture.
function AuthGate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="auth-loading">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginPage />;
  }

  return (
    <PortfolioDataProvider>
      <AuthenticatedRoutes />
    </PortfolioDataProvider>
  );
}

// Gates the whole route table behind Onboarding (docs/use-cases.md): whenever
// the active portfolio doesn't yet have both an Investment and a Cash
// account, no route below — including the tab bar — is reachable, so this
// checks accounts before the router mounts at all rather than redirecting
// from within it. Checking both types (not just accounts.length > 0) is what
// keeps Onboarding mounted through its own step 1→2 transition — its own
// refetch after creating the Investment account would otherwise already
// satisfy a bare "has an account" gate and skip the Cash step entirely.
// The full-screen spinner shows only when there's genuinely nothing to render
// yet — the initial load (accounts still empty) or an explicit portfolio
// switch (`switching`, which also guards against a stale-frame/Onboarding
// flash while the swap's refetch is in flight). It must NOT key off
// `loading.accounts` alone: that flag also flips during a background refresh
// (post-mutation refreshAccounts, pull-to-refresh), and unmounting the
// IonRouterOutlet mid-navigation tears down its view stack — the app is left
// on a blank screen until it's relaunched (the "close and reopen" bug).
function AuthenticatedRoutes() {
  const { accounts, loading, switching } = usePortfolioData();

  if (switching || (loading.accounts && accounts.length === 0)) {
    return (
      <div className="auth-loading">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  const hasBothAccountTypes =
    accounts.some((a) => a.type === "investment") && accounts.some((a) => a.type === "cash");

  if (!hasBothAccountTypes) {
    return <OnboardingPage />;
  }

  return (
    <IonRouterOutlet>
      <Route path="/tabs" render={() => <Tabs />} />
      <Route exact path="/">
        <Redirect to="/tabs/portfolio" />
      </Route>
    </IonRouterOutlet>
  );
}

export default AuthGate;
