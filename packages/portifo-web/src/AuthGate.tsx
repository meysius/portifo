import { IonRouterOutlet, IonSpinner } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import { Redirect, Route, useHistory } from "react-router-dom";
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
//
// Once <Tabs/> has mounted at least once (`tabsEverMounted`), it stays
// mounted through every later portfolio switch instead of being swapped for
// a spinner: unmounting the IonRouterOutlet mid-navigation tears down its —
// and every nested per-tab outlet's — view stack, leaving the app on a
// blank screen until it's relaunched (the "close and reopen" bug). That
// used to happen on *every* switch between two already-onboarded
// portfolios, and got worse the more tabs/pushed routes a user had visited
// first, since there was more view-stack state to lose. The blocking
// full-screen spinner is now reserved for the genuine first load, before
// there's anything underneath worth preserving; a `switching` swap instead
// renders as a full-screen overlay on top of the still-mounted tabs, with a
// reset back to the portfolio tab's root (see the effect below) so a
// pushed detail route referencing the outgoing portfolio's account/asset
// ids doesn't linger once the incoming portfolio's data lands. Switching
// *into* a portfolio that itself needs onboarding (e.g. a brand new one)
// still fully swaps Tabs out for OnboardingPage — that's a legitimate mode
// change, not a same-shape round trip, so there's no view-stack to lose.
function AuthenticatedRoutes() {
  const { accounts, loading, switching } = usePortfolioData();
  const history = useHistory();
  const [tabsEverMounted, setTabsEverMounted] = useState(false);
  const wasSwitchingRef = useRef(false);

  useEffect(() => {
    if (switching && !wasSwitchingRef.current) {
      history.replace("/tabs/portfolio");
    }
    wasSwitchingRef.current = switching;
  }, [switching, history]);

  const hasBothAccountTypes =
    accounts.some((a) => a.type === "investment") && accounts.some((a) => a.type === "cash");

  useEffect(() => {
    if (!switching && hasBothAccountTypes) setTabsEverMounted(true);
  }, [switching, hasBothAccountTypes]);

  if (!tabsEverMounted && (switching || (loading.accounts && accounts.length === 0))) {
    return (
      <div className="auth-loading">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  if (!switching && !hasBothAccountTypes) {
    return <OnboardingPage />;
  }

  return (
    <>
      <IonRouterOutlet>
        <Route path="/tabs" render={() => <Tabs />} />
        <Route exact path="/">
          <Redirect to="/tabs/portfolio" />
        </Route>
      </IonRouterOutlet>
      {switching && (
        <div className="auth-loading auth-loading-overlay">
          <IonSpinner name="crescent" />
        </div>
      )}
    </>
  );
}

export default AuthGate;
