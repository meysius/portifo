import type { Router } from "framework7/types";

import RootPage from "./pages/Root.tsx";
import TransactionsPage from "./pages/Transactions.tsx";
import AccountsPage from "./pages/Accounts.tsx";
import SettingsPage from "./pages/Settings.tsx";

const routes: Router.RouteParameters[] = [
  { path: "/", component: RootPage },
  { path: "/transactions/", component: TransactionsPage },
  { path: "/accounts/", component: AccountsPage },
  { path: "/settings/", component: SettingsPage },
];

export default routes;
