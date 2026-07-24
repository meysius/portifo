import { createStore } from "framework7";
import { fetchCurrentUser, loginWithGoogle as apiLoginWithGoogle, logout as apiLogout } from "./api/auth";
import type { AuthUser } from "./api/auth";
import { requestGoogleAccessToken } from "./lib/googleAuth";
import { setUnauthorizedHandler } from "./api/http";
import { listAccounts, createAccount as apiCreateAccount } from "./api/accounts";
import type { AccountDto, NewAccount } from "./api/accounts";

// Framework7 mounts routed pages (anything reached via the `routes` table —
// see routes.ts) through its own imperative page-component loader, outside
// normal React reconciliation, so React Context set up by an ancestor in
// JSX never reaches them (confirmed: usePortfolioData/useAuth threw "must be
// used within Provider" from inside a routed page even though the Provider
// was a JSX ancestor). Framework7's own Store — subscribed to via useStore,
// which works off this plain object reference rather than the React tree —
// is what's actually shared across both static (Login/Onboarding) and
// routed (Holdings/Settings, and anything pushed later) pages.
interface StoreState {
  authStatus: "loading" | "unauthenticated" | "authenticated";
  user: AuthUser | null;
  accounts: AccountDto[];
  loadingAccounts: boolean;
}

export const store = createStore({
  state: {
    authStatus: "loading",
    user: null,
    accounts: [],
    loadingAccounts: true,
  } as StoreState,
  getters: {
    authStatus({ state }: { state: StoreState }) {
      return state.authStatus;
    },
    user({ state }: { state: StoreState }) {
      return state.user;
    },
    accounts({ state }: { state: StoreState }) {
      return state.accounts;
    },
    loadingAccounts({ state }: { state: StoreState }) {
      return state.loadingAccounts;
    },
    hasBothAccountTypes({ state }: { state: StoreState }) {
      return state.accounts.some((a) => a.type === "investment") && state.accounts.some((a) => a.type === "cash");
    },
  },
  actions: {
    async init({ state }: { state: StoreState }) {
      try {
        const user = await fetchCurrentUser();
        state.user = user;
        state.authStatus = user ? "authenticated" : "unauthenticated";
        if (user) await store.dispatch("refreshAccounts", undefined);
      } catch {
        state.user = null;
        state.authStatus = "unauthenticated";
      }
    },
    async loginWithGoogle({ state }: { state: StoreState }) {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
      if (!clientId) throw new Error("Missing VITE_GOOGLE_CLIENT_ID");
      const accessToken = await requestGoogleAccessToken(clientId);
      const user = await apiLoginWithGoogle(accessToken);
      state.user = user;
      state.authStatus = "authenticated";
      await store.dispatch("refreshAccounts", undefined);
    },
    async logout({ state }: { state: StoreState }) {
      await apiLogout();
      state.user = null;
      state.authStatus = "unauthenticated";
      state.accounts = [];
    },
    async refreshAccounts({ state }: { state: StoreState }) {
      state.loadingAccounts = true;
      state.accounts = await listAccounts();
      state.loadingAccounts = false;
    },
    async createAccount({ state: _state }: { state: StoreState }, input: NewAccount) {
      const account = await apiCreateAccount(input);
      await store.dispatch("refreshAccounts", undefined);
      return account;
    },
  },
});

// A 401 mid-session (expired cookie) on any apiFetch call anywhere in the
// app resets auth state and bounces back to the login screen.
setUnauthorizedHandler(() => {
  store.state.authStatus = "unauthenticated";
  store.state.user = null;
});

store.dispatch("init", undefined);
