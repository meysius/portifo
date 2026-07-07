import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  listPortfolios,
  createPortfolio as apiCreatePortfolio,
  listAccounts,
  createAccount as apiCreateAccount,
  updateCashBalance as apiUpdateCashBalance,
  listTransactions,
  createTransaction as apiCreateTransaction,
  updateTransaction as apiUpdateTransaction,
  deleteTransaction as apiDeleteTransaction,
} from "../api/portfolio";
import type { AccountDto, NewAccount, NewTransaction, PortfolioDto, Transaction } from "../api/portfolio";
import { setActivePortfolioId as setApiActivePortfolioId } from "../api/http";
import { getQuotes, getFxRates } from "../api/market";
import type { Quote } from "../api/market";
import { DISPLAY_CURRENCIES, FX_FALLBACK } from "../lib/fx";
import type { FxRates } from "../lib/fx";
import { aggregateTickers, computeOpenPositions, computeRealizedPLByTransaction } from "../lib/positions";
import type { OpenPosition, TickerAgg } from "../lib/positions";

interface PortfolioDataContextValue {
  portfolios: PortfolioDto[];
  activePortfolio: PortfolioDto | null;
  switchPortfolio(id: string): Promise<void>;
  // True only while switchPortfolio is swapping the active portfolio's data.
  // AuthGate shows a full-screen spinner during this (and only this, plus the
  // very first load) — never on a background refresh, which must not unmount
  // the router. See the AuthenticatedRoutes gate.
  switching: boolean;
  createPortfolio(name: string): Promise<PortfolioDto>;
  accounts: AccountDto[];
  transactions: Transaction[];
  quotes: Record<string, Quote>;
  fxRates: FxRates;
  fxAsOf: string | null;
  loading: { accounts: boolean; transactions: boolean; market: boolean };
  refreshAccounts(opts?: { silent?: boolean }): Promise<void>;
  refreshTransactions(opts?: { silent?: boolean }): Promise<void>;
  refreshMarket(symbols: string[]): Promise<void>;
  createTransaction(input: NewTransaction): Promise<Transaction>;
  updateTransaction(id: string, input: NewTransaction): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  createAccount(input: NewAccount): Promise<AccountDto>;
  updateCashBalance(accountId: string, currency: string, balance: number): Promise<AccountDto>;
  // Derived, memoized off accounts/transactions.
  tickerAggregates: TickerAgg[];
  realizedPLByTx: Map<string, number>;
  openPositionsFor(accountName: string): OpenPosition[];
  // Sum of every account's own currency balances (investment accounts carry
  // leftover cash too) — single source shared by HoldingsPage's Cash row and
  // CashDetailPage so the two totals can never diverge.
  cashByCurrency: Record<string, number>;
  // True once the portfolio has a transaction on an Investment Account or a
  // currency balance on a Cash Account — the Portfolio/Transactions/Accounts
  // tabs stay in their empty state until this flips, even though Onboarding
  // has already created the first two accounts by then (see use-cases.md).
  hasActivity: boolean;
}

const PortfolioDataContext = createContext<PortfolioDataContextValue | null>(null);

// Mounted only while authenticated (see AuthGate) — this is the direct
// replacement for portifo-web's MainScreen owning all app-wide data as
// component state; here it's a context so routed pages can consume it
// without prop-drilling through the router.
const ACTIVE_PORTFOLIO_KEY = "portifo.activePortfolioId";

export function PortfolioDataProvider({ children }: { children: ReactNode }) {
  const [portfolios, setPortfolios] = useState<PortfolioDto[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [fxRates, setFxRates] = useState<FxRates>(FX_FALLBACK);
  const [fxAsOf, setFxAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState({ accounts: true, transactions: true, market: true });
  const [switching, setSwitching] = useState(false);

  // `silent` refreshes update the data in place without toggling the loading
  // flags. Mutations use it so the create/update/delete → navigate sequence
  // doesn't churn loading state mid-transition (a router re-render at that
  // instant is what leaves iOS on a blank screen). Initial load, portfolio
  // switch, and pull-to-refresh stay non-silent so their spinners still show.
  const refreshAccounts = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading((l) => ({ ...l, accounts: true }));
    try {
      setAccounts(await listAccounts());
    } finally {
      if (!silent) setLoading((l) => ({ ...l, accounts: false }));
    }
  }, []);

  const refreshTransactions = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading((l) => ({ ...l, transactions: true }));
    try {
      setTransactions(await listTransactions());
    } finally {
      if (!silent) setLoading((l) => ({ ...l, transactions: false }));
    }
  }, []);

  const refreshMarket = useCallback(
    async (symbols: string[]) => {
      setLoading((l) => ({ ...l, market: true }));
      try {
        const currencySet = new Set<string>(DISPLAY_CURRENCIES);
        for (const account of accounts) {
          for (const balance of account.balances) currencySet.add(balance.currency);
        }
        currencySet.delete("USD");

        const [quoteList, fx] = await Promise.all([
          symbols.length ? getQuotes(symbols).catch(() => []) : Promise.resolve([]),
          getFxRates("USD", Array.from(currencySet)).catch(() => null),
        ]);

        if (quoteList.length) {
          setQuotes((prev) => {
            const next = { ...prev };
            for (const q of quoteList) next[q.symbol] = q;
            return next;
          });
        }
        if (fx) {
          setFxRates(fx.rates);
          setFxAsOf(fx.asOf);
        }
      } finally {
        setLoading((l) => ({ ...l, market: false }));
      }
    },
    [accounts],
  );

  // Makes a portfolio the active one: every subsequent apiFetch carries it as
  // X-Portfolio-Id, and the choice survives reloads via localStorage.
  const activatePortfolio = useCallback((id: string | null) => {
    setApiActivePortfolioId(id);
    setActivePortfolioId(id);
    if (id) localStorage.setItem(ACTIVE_PORTFOLIO_KEY, id);
    else localStorage.removeItem(ACTIVE_PORTFOLIO_KEY);
  }, []);

  useEffect(() => {
    (async () => {
      // The active portfolio must be resolved (and its header set) before the
      // initial accounts/transactions fetches, or they'd hit the wrong one.
      try {
        const list = await listPortfolios();
        setPortfolios(list);
        const stored = localStorage.getItem(ACTIVE_PORTFOLIO_KEY);
        activatePortfolio(list.find((p) => p.id === stored)?.id ?? list[0]?.id ?? null);
      } catch {
        // Non-fatal: requests without the header fall back to the first
        // portfolio server-side.
      }
      refreshAccounts();
      refreshTransactions();
      refreshMarket([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchPortfolio = useCallback(
    async (id: string) => {
      activatePortfolio(id);
      // Signals AuthGate to show a spinner for the swap: the outgoing
      // portfolio's accounts stay in state until the refetch lands, so
      // without this the router would briefly render the previous
      // portfolio's tabs (or flash Onboarding for an empty one).
      setSwitching(true);
      try {
        await Promise.all([refreshAccounts(), refreshTransactions()]);
      } finally {
        setSwitching(false);
      }
    },
    [activatePortfolio, refreshAccounts, refreshTransactions],
  );

  const createPortfolioFn = useCallback(
    async (name: string) => {
      const portfolio = await apiCreatePortfolio(name);
      setPortfolios((prev) => [...prev, portfolio]);
      await switchPortfolio(portfolio.id);
      return portfolio;
    },
    [switchPortfolio],
  );

  const createTransactionFn = useCallback(
    async (input: NewTransaction) => {
      const tx = await apiCreateTransaction(input);
      await Promise.all([refreshTransactions({ silent: true }), refreshAccounts({ silent: true })]);
      return tx;
    },
    [refreshTransactions, refreshAccounts],
  );

  const updateTransactionFn = useCallback(
    async (id: string, input: NewTransaction) => {
      const tx = await apiUpdateTransaction(id, input);
      await Promise.all([refreshTransactions({ silent: true }), refreshAccounts({ silent: true })]);
      return tx;
    },
    [refreshTransactions, refreshAccounts],
  );

  const deleteTransactionFn = useCallback(
    async (id: string) => {
      await apiDeleteTransaction(id);
      await Promise.all([refreshTransactions({ silent: true }), refreshAccounts({ silent: true })]);
    },
    [refreshTransactions, refreshAccounts],
  );

  const createAccountFn = useCallback(
    async (input: NewAccount) => {
      const account = await apiCreateAccount(input);
      await refreshAccounts({ silent: true });
      return account;
    },
    [refreshAccounts],
  );

  const updateCashBalanceFn = useCallback(
    async (accountId: string, currency: string, balance: number) => {
      const account = await apiUpdateCashBalance(accountId, currency, balance);
      await refreshAccounts({ silent: true });
      return account;
    },
    [refreshAccounts],
  );

  const tickerAggregates = useMemo(() => aggregateTickers(transactions), [transactions]);
  const realizedPLByTx = useMemo(() => computeRealizedPLByTransaction(transactions), [transactions]);
  const openPositionsFor = useCallback((accountName: string) => computeOpenPositions(accountName, transactions), [transactions]);

  const cashByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const account of accounts) {
      for (const balance of account.balances) {
        totals[balance.currency] = (totals[balance.currency] ?? 0) + balance.balance;
      }
    }
    return totals;
  }, [accounts]);

  const hasActivity = useMemo(
    () => transactions.length > 0 || accounts.some((a) => a.balances.length > 0),
    [transactions, accounts],
  );

  const value: PortfolioDataContextValue = {
    portfolios,
    activePortfolio: portfolios.find((p) => p.id === activePortfolioId) ?? null,
    switchPortfolio,
    switching,
    createPortfolio: createPortfolioFn,
    accounts,
    transactions,
    quotes,
    fxRates,
    fxAsOf,
    loading,
    refreshAccounts,
    refreshTransactions,
    refreshMarket,
    createTransaction: createTransactionFn,
    updateTransaction: updateTransactionFn,
    deleteTransaction: deleteTransactionFn,
    createAccount: createAccountFn,
    updateCashBalance: updateCashBalanceFn,
    tickerAggregates,
    realizedPLByTx,
    openPositionsFor,
    cashByCurrency,
    hasActivity,
  };

  return <PortfolioDataContext.Provider value={value}>{children}</PortfolioDataContext.Provider>;
}

export function usePortfolioData(): PortfolioDataContextValue {
  const ctx = useContext(PortfolioDataContext);
  if (!ctx) throw new Error("usePortfolioData must be used within PortfolioDataProvider");
  return ctx;
}
