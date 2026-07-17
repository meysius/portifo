import { IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from "@ionic/react";
import { Redirect, Route } from "react-router-dom";
import HoldingsPage from "./pages/HoldingsPage";
import TransactionsPage from "./pages/TransactionsPage";
import AccountsPage from "./pages/AccountsPage";
import SettingsPage from "./pages/SettingsPage";
import ManagePortfolioPage from "./pages/ManagePortfolioPage";
import AddMemberPage from "./pages/AddMemberPage";
import AssetDetailPage from "./pages/AssetDetailPage";
import AccountDetailPage from "./pages/AccountDetailPage";
import CashAccountDetailPage from "./pages/CashAccountDetailPage";
import CashDetailPage from "./pages/CashDetailPage";
import AddTransactionPage from "./pages/AddTransactionPage";
import TransactionDetailPage from "./pages/TransactionDetailPage";
import UpdateBalancePage from "./pages/UpdateBalancePage";
import { TabBaseProvider } from "./context/TabBaseContext";

// Tab icons copied 1:1 from docs/design-system.html's .tabbar specimen
// (22×22 line icons, 1.7 stroke — except settings' gear, at the DS's own
// 1.5 stroke, since its denser path reads cluttered at 1.7).
const ICONS = {
  portfolio: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.7 15.5A9.3 9.3 0 1 1 8.4 3.43" />
      <path d="M21.3 12A9.3 9.3 0 0 0 12 2.7V12h9.3Z" />
    </svg>
  ),
  transactions: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8h13M17 8l-3.2-3.2M17 8l-3.2 3.2" />
      <path d="M20 16H7M7 16l3.2-3.2M7 16l3.2 3.2" />
    </svg>
  ),
  accounts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5a2 2 0 0 1 2-2h11l4 4v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z" />
      <path d="M15 12.2h3.2" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.99l1.004.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a7.688 7.688 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
};

// Each tab gets its own nested IonRouterOutlet (rather than one flat outlet
// shared by all four tab roots) so that every route a tab can push — detail
// pages included — lives in that same outlet. Ionic keeps a nested outlet's
// visibility in sync with the *current URL*; a route pushed outside a tab's
// own outlet stays hidden for the whole interactive swipe-back gesture and
// only pops visible once the gesture completes and the URL lands, which
// looked like the page "reloading" mid-swipe. See TabBaseContext for why
// some of these routes (asset, account, cash-account, update-balance,
// add-transaction) are registered under more than one tab prefix.

function PortfolioStack() {
  return (
    <TabBaseProvider tabBase="/tabs/portfolio" tabLabel="Portfolio">
      <IonRouterOutlet>
        <Route exact path="/tabs/portfolio" component={HoldingsPage} />
        <Route exact path="/tabs/portfolio/asset/:symbol" component={AssetDetailPage} />
        <Route exact path="/tabs/portfolio/cash" component={CashDetailPage} />
        <Route exact path="/tabs/portfolio/account/:accountId" component={AccountDetailPage} />
        <Route exact path="/tabs/portfolio/cash-account/:accountId" component={CashAccountDetailPage} />
        <Route exact path="/tabs/portfolio/update-balance/:accountId" component={UpdateBalancePage} />
        <Route exact path="/tabs/portfolio/update-balance/:accountId/:currency" component={UpdateBalancePage} />
        <Route exact path="/tabs/portfolio/add-transaction" component={AddTransactionPage} />
      </IonRouterOutlet>
    </TabBaseProvider>
  );
}

function AccountsStack() {
  return (
    <TabBaseProvider tabBase="/tabs/accounts" tabLabel="Accounts">
      <IonRouterOutlet>
        <Route exact path="/tabs/accounts" component={AccountsPage} />
        <Route exact path="/tabs/accounts/account/:accountId" component={AccountDetailPage} />
        <Route exact path="/tabs/accounts/cash-account/:accountId" component={CashAccountDetailPage} />
        <Route exact path="/tabs/accounts/asset/:symbol" component={AssetDetailPage} />
        <Route exact path="/tabs/accounts/update-balance/:accountId" component={UpdateBalancePage} />
        <Route exact path="/tabs/accounts/update-balance/:accountId/:currency" component={UpdateBalancePage} />
        <Route exact path="/tabs/accounts/add-transaction" component={AddTransactionPage} />
      </IonRouterOutlet>
    </TabBaseProvider>
  );
}

function TransactionsStack() {
  return (
    <TabBaseProvider tabBase="/tabs/transactions" tabLabel="Transactions">
      <IonRouterOutlet>
        <Route exact path="/tabs/transactions" component={TransactionsPage} />
        <Route exact path="/tabs/transactions/transaction/:transactionId" component={TransactionDetailPage} />
        <Route exact path="/tabs/transactions/add-transaction" component={AddTransactionPage} />
        <Route exact path="/tabs/transactions/add-transaction/:transactionId" component={AddTransactionPage} />
      </IonRouterOutlet>
    </TabBaseProvider>
  );
}

function SettingsStack() {
  return (
    <TabBaseProvider tabBase="/tabs/settings" tabLabel="Settings">
      <IonRouterOutlet>
        <Route exact path="/tabs/settings" component={SettingsPage} />
        <Route exact path="/tabs/settings/portfolio" component={ManagePortfolioPage} />
        <Route exact path="/tabs/settings/add-member" component={AddMemberPage} />
      </IonRouterOutlet>
    </TabBaseProvider>
  );
}

function Tabs() {
  // Pushed detail pages now live inside each tab's own outlet (for the
  // swipe-back fix above), which means they're rendered inside IonTabs and
  // would otherwise inherit the bottom tab bar — these are meant to be
  // full-screen, tab-bar-free pushed pages, same as before that change.
  // Visibility is driven entirely by CSS (see index.css's `.tab-root-page`
  // rule), not React state keyed off the route: routeInfo/location updates
  // *instantly* on navigation, well before Ionic's own page-transition
  // animation (~300ms) finishes, so a React-driven toggle flips the tab
  // bar's flex-layout presence mid-transition — the still-animating-out
  // page's content visibly gets squished to make room for a tab bar that
  // shouldn't exist yet. CSS keyed off `ion-page-hidden` (which Ionic only
  // toggles once the transition actually completes) stays in sync with
  // what's visually on screen instead of the URL.
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/tabs/portfolio" render={() => <PortfolioStack />} />
        <Route path="/tabs/transactions" render={() => <TransactionsStack />} />
        <Route path="/tabs/accounts" render={() => <AccountsStack />} />
        <Route path="/tabs/settings" render={() => <SettingsStack />} />
        <Route exact path="/tabs">
          <Redirect to="/tabs/portfolio" />
        </Route>
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="portfolio" href="/tabs/portfolio">
          <span className="tab-icon">{ICONS.portfolio}</span>
          <IonLabel>Portfolio</IonLabel>
        </IonTabButton>
        <IonTabButton tab="transactions" href="/tabs/transactions">
          <span className="tab-icon">{ICONS.transactions}</span>
          <IonLabel>Transactions</IonLabel>
        </IonTabButton>
        <IonTabButton tab="accounts" href="/tabs/accounts">
          <span className="tab-icon">{ICONS.accounts}</span>
          <IonLabel>Accounts</IonLabel>
        </IonTabButton>
        <IonTabButton tab="settings" href="/tabs/settings">
          <span className="tab-icon">{ICONS.settings}</span>
          <IonLabel>Settings</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

export default Tabs;
