import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import DateSheet from "../components/DateSheet";
import PickerSheet from "../components/PickerSheet";
import type { PickerOption } from "../components/PickerSheet";
import { ChevronDownIcon, MoneyHero } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useToast } from "../context/ToastContext";
import { getQuotes, searchSymbols } from "../api/market";
import type { Quote, SymbolResult } from "../api/market";
import type { NewTransaction, TransactionType } from "../api/portfolio";
import { CURRENCIES } from "../lib/currencies";
import { fmtCcy, fmtShares } from "../lib/fx";

// What the first step picks. Deposit, Withdraw and Set balance are one choice,
// Cash, split by a switch on its last screen — they answer the same questions.
type Kind = "buy" | "sell" | "cash";
type CashMode = "deposit" | "withdraw" | "set";

type LocationState =
  | { type?: Kind; cashMode?: CashMode; symbol?: string; account?: string; currency?: string }
  | undefined;

// POC: a step-at-a-time replacement for AddTransactionPage's create mode (edit
// still uses the form). Each kind gets the shortest path that can produce a
// valid transaction:
//   Buy   type → account → symbol → shares & price
//   Sell  type → position (account + symbol in one tap) → shares & price
//   Cash  type → account → Deposit / Withdraw (amount & date) or Set balance
//         (current balance shown, new one typed; always as of today)
// A step whose answer is already known — prefilled by the entry point, or the
// only possible choice — is skipped, and stays reachable through its crumb.
// An account's cash row opens straight onto Cash → Set balance.
type StepId = "type" | "account" | "symbol" | "position" | "details";

type Draft = {
  kind?: Kind;
  cashMode: CashMode;
  account: string;
  symbol: string;
  symbolName: string;
  shares: string;
  price: string;
  amount: string;
  balance: string;
  currency: string;
  date: string;
  notes: string;
};

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "buy", label: "Buy", hint: "Shares added to a holding" },
  { value: "sell", label: "Sell", hint: "Shares sold out of a holding" },
  { value: "cash", label: "Cash", hint: "Deposit, withdraw, or set a balance" },
];

const KIND_LABEL = Object.fromEntries(KINDS.map((t) => [t.value, t.label])) as Record<Kind, string>;

const SYMBOL_DEBOUNCE_MS = 250;
const EPSILON = 1e-9;

// A quote as the price field's text: cents, unless it's a sub-dollar price
// where cents would round the figure away.
function priceText(price: number) {
  return String(Number(price.toFixed(price >= 1 ? 2 : 4)));
}

function stepsFor(kind?: Kind): StepId[] {
  if (kind === "buy") return ["type", "account", "symbol", "details"];
  if (kind === "sell") return ["type", "position", "details"];
  if (kind) return ["type", "account", "details"];
  return ["type"];
}

// Digits and a single decimal point — the fields are text inputs with a decimal
// keypad rather than type=number, which reports "" for a half-typed "12.".
function cleanDecimal(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function AddTransactionWizardPage({ location }: RouteComponentProps) {
  const history = useHistory();
  const { accounts, transactions, quotes, tickerAggregates, createTransaction, createAccount, setBalance } =
    usePortfolioData();
  const { tabBase, tabLabel } = useTabBase();
  const { showToast } = useToast();

  // Everything that can be sold: one row per (symbol, account) still holding shares.
  const positions = useMemo(
    () =>
      tickerAggregates.flatMap((t) =>
        t.perAccount
          .filter((p) => p.shares > EPSILON)
          .map((p) => ({ symbol: t.symbol, account: p.account, shares: p.shares, currency: t.currency })),
      ),
    [tickerAggregates],
  );
  const heldShares = (account: string, symbol: string) =>
    positions.find((p) => p.account === account && p.symbol === symbol)?.shares ?? 0;

  const isAnswered = (step: StepId, d: Draft) => {
    if (step === "type") return !!d.kind;
    if (step === "account") return !!d.account;
    if (step === "symbol") return !!d.symbol;
    if (step === "position") return heldShares(d.account, d.symbol) > EPSILON;
    return false;
  };

  // The first step after `from` that still needs an answer — so changing one
  // answer through a crumb lands straight back on the last step.
  const nextStep = (from: StepId | null, d: Draft): StepId => {
    const steps = stepsFor(d.kind);
    const start = from ? steps.indexOf(from) + 1 : 0;
    return steps.slice(start).find((s) => !isAnswered(s, d)) ?? "details";
  };

  const [initial] = useState(() => {
    const state = location.state as LocationState;
    const symbol = state?.symbol ?? "";
    const holders = positions.filter((p) => p.symbol === symbol);
    let account = state?.account ?? (accounts.length === 1 ? accounts[0].name : "");
    if (state?.type === "sell" && holders.length === 1) account = holders[0].account;
    const draft: Draft = {
      kind: state?.type,
      cashMode: state?.cashMode ?? "deposit",
      account,
      symbol,
      symbolName: quotes[symbol]?.shortName ?? "",
      shares: "",
      price: "",
      amount: "",
      balance: "",
      currency: state?.currency ?? accounts.find((a) => a.name === account)?.balances[0]?.currency ?? "USD",
      date: todayIso(),
      notes: "",
    };
    return { draft, step: nextStep(null, draft) };
  });
  const [draft, setDraft] = useState(initial.draft);
  const [step, setStep] = useState<StepId>(initial.step);
  const [saving, setSaving] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [newAccount, setNewAccount] = useState("");

  const { kind, cashMode } = draft;
  const isCash = kind === "cash";
  const isSetBalance = isCash && cashMode === "set";
  // The ledger type this saves as; Set balance saves through its own endpoint.
  const type: TransactionType | undefined = isCash ? (cashMode === "set" ? undefined : cashMode) : kind;
  const steps = stepsFor(kind);
  const stepIndex = steps.indexOf(step);

  // iOS only raises the keyboard for a focus() inside the tap's own task, and
  // the next step's field doesn't exist until React renders it. Same proxy
  // trick as PickerSheet: focus a 1px input now, hand over once the step mounts.
  const hoistRef = useRef<HTMLInputElement>(null);
  const focusRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    focusRef.current?.focus();
  }, [step]);

  const goTo = (target: StepId) => {
    if (target === "symbol" || target === "details") hoistRef.current?.focus();
    setStep(target);
  };

  const answer = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    goTo(nextStep(step, next));
  };

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const handleBack = () => {
    if (step === initial.step || stepIndex <= 0) history.goBack();
    else goTo(steps[stepIndex - 1]);
  };

  // ----- symbol search (buy) -----
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const id = ++requestId.current;
    setSearchError(false);
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchSymbols(trimmed);
        if (requestId.current === id) setResults(found);
      } catch {
        if (requestId.current === id) setSearchError(true);
      } finally {
        if (requestId.current === id) setSearching(false);
      }
    }, SYMBOL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // ----- market price: prefills the price field so a trade at market is just
  // "type the share count". Never overwrites a price the user typed. -----
  const [market, setMarket] = useState<Quote>();
  const priceTouched = useRef(false);

  useEffect(() => {
    setMarket(undefined);
    if (!draft.symbol) return;
    let cancelled = false;
    const apply = (quote?: Quote) => {
      if (cancelled || !quote) return;
      setMarket(quote);
      setDraft((d) => ({
        ...d,
        currency: quote.currency || d.currency,
        symbolName: d.symbolName || quote.shortName || "",
        price: priceTouched.current ? d.price : priceText(quote.price),
      }));
    };
    const known = quotes[draft.symbol];
    if (known) apply(known);
    else
      getQuotes([draft.symbol])
        .then((found) => apply(found[0]))
        .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.symbol]);

  const pickSymbol = (symbol: string, symbolName: string, account?: string) => {
    if (symbol !== draft.symbol) priceTouched.current = false;
    answer({
      symbol,
      symbolName,
      ...(account ? { account } : {}),
      ...(symbol !== draft.symbol ? { price: "", shares: "" } : {}),
    });
  };

  // A different kind is a different transaction: answers picked for the old
  // one (a Sell's position sets the account too) must not skip the new one's
  // steps, so fall back to what the wizard opened with.
  const pickKind = (next: Kind) => {
    if (next === kind) return answer({});
    priceTouched.current = false;
    answer({
      kind: next,
      account: initial.draft.account,
      symbol: initial.draft.symbol,
      symbolName: initial.draft.symbolName,
      shares: "",
      price: "",
      amount: "",
      balance: "",
    });
  };

  const pickAccount = (account: string) => {
    const balances = accounts.find((a) => a.name === account)?.balances ?? [];
    answer({ account, ...(isCash && balances[0] ? { currency: balances[0].currency } : {}) });
  };

  // ----- derived figures -----
  const sharesNum = Number(draft.shares);
  const priceNum = Number(draft.price);
  const amountNum = Number(draft.amount);
  const balanceNum = Number(draft.balance);
  const held = kind === "sell" ? heldShares(draft.account, draft.symbol) : 0;
  const overSold = kind === "sell" && sharesNum > held + EPSILON;
  const selectedAccount = accounts.find((a) => a.name === draft.account);
  const cashBalance = selectedAccount?.balances.find((b) => b.currency === draft.currency)?.balance;
  const total = !isCash && sharesNum > 0 && draft.price.trim() && Number.isFinite(priceNum) ? sharesNum * priceNum : null;
  // What Set balance will record: the gap between the balance shown and the
  // one typed, saved as a deposit (positive) or withdrawal (negative).
  const balanceDelta = isSetBalance && draft.balance.trim() ? balanceNum - (cashBalance ?? 0) : null;
  // An earlier update today gets rewritten rather than joined by a second row,
  // so the row actually saved carries both changes.
  const sameDayUpdate = transactions.find(
    (t) =>
      t.fromBalanceUpdate && t.account === draft.account && t.currency === draft.currency && t.date === todayIso(),
  );
  const savedDelta =
    balanceDelta == null
      ? null
      : balanceDelta + (sameDayUpdate ? (sameDayUpdate.type === "withdraw" ? -1 : 1) * (sameDayUpdate.amount ?? 0) : 0);

  const isValid =
    !!kind &&
    !!draft.account &&
    (isSetBalance
      ? balanceDelta != null && Number.isFinite(balanceDelta) && Math.abs(balanceDelta) > 0.004
      : isCash
        ? amountNum > 0
        : !!draft.symbol && sharesNum > 0 && draft.price.trim().length > 0 && priceNum >= 0 && !overSold);

  const handleSetBalance = async () => {
    setSaving(true);
    try {
      // A name typed on the account step may not exist yet — transactions
      // create it server-side, the balance endpoint needs it to exist first.
      const accountId = selectedAccount?.id ?? (await createAccount({ name: draft.account })).id;
      await setBalance(accountId, draft.currency, balanceNum, todayIso());
      showToast("Balance updated");
      history.goBack();
    } catch {
      showToast("Failed to update balance", { color: "danger" });
      setSaving(false);
    }
  };

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!isValid || saving) return;
    if (isSetBalance) return handleSetBalance();
    if (!type) return;
    const input: NewTransaction = {
      type,
      account: draft.account,
      date: draft.date.slice(0, 10),
      currency: draft.currency,
      ...(isCash
        ? { amount: amountNum }
        : { symbol: draft.symbol.toUpperCase(), shares: sharesNum, pricePerShare: priceNum }),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    };
    setSaving(true);
    try {
      await createTransaction(input);
      showToast("Transaction saved");
      history.goBack();
    } catch {
      showToast("Failed to save transaction", { color: "danger" });
      setSaving(false);
    }
  };

  const isToday = draft.date.slice(0, 10) === todayIso();
  const dateLabel = isToday
    ? "Today"
    : new Date(`${draft.date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  const currencyOptions: PickerOption[] = CURRENCIES.map((c) => ({ value: c.code, label: c.code, sublabel: c.name }));

  // Answers given so far, each a way back to the step that asked for it.
  const crumbs: { step: StepId; label: string }[] = [];
  for (const s of steps.slice(0, Math.max(stepIndex, 0))) {
    if (s === "type" && kind) crumbs.push({ step: s, label: KIND_LABEL[kind] });
    if (s === "account" && draft.account) crumbs.push({ step: s, label: draft.account });
    if (s === "symbol" && draft.symbol) crumbs.push({ step: s, label: draft.symbol });
    if (s === "position" && draft.symbol) crumbs.push({ step: s, label: `${draft.symbol} · ${draft.account}` });
  }

  const question: Record<StepId, string> = {
    type: "What kind of transaction?",
    account: "Which account?",
    symbol: "What did you buy?",
    position: "What did you sell?",
    details: isSetBalance ? "What's the balance now?" : isCash ? "How much?" : "How many, at what price?",
  };

  let body: ReactNode = null;

  if (step === "type") {
    body = (
      <IonList inset>
        {KINDS.map((t) => (
          <IonItem key={t.value} button detail onClick={() => pickKind(t.value)}>
            <IonLabel>
              <h2>{t.label}</h2>
              <p>{t.hint}</p>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
    );
  } else if (step === "account") {
    const name = newAccount.trim();
    body = (
      <>
        {accounts.length > 0 && (
          <IonList inset>
            {accounts.map((a) => (
              <IonItem key={a.id} button detail onClick={() => pickAccount(a.name)}>
                <IonLabel>
                  <h2>{a.name}</h2>
                  {isCash && a.balances.length > 0 && (
                    <p>{a.balances.map((b) => fmtCcy(b.balance, b.currency)).join(" · ")} cash</p>
                  )}
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}
        <form
          className="wiz-inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (name) pickAccount(name);
          }}
        >
          <input
            className="wiz-text"
            placeholder="Or name a new account"
            enterKeyHint="next"
            value={newAccount}
            onChange={(e) => setNewAccount(e.target.value)}
          />
          {name && (
            <button type="submit" className="wiz-inline-go">
              Use
            </button>
          )}
        </form>
      </>
    );
  } else if (step === "symbol") {
    const trimmed = query.trim();
    const owned = tickerAggregates.filter((t) => !t.closed);
    body = (
      <>
        <div className="wiz-inline">
          <input
            ref={focusRef}
            className="wiz-text"
            type="search"
            placeholder="Search ticker or company"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && <IonSpinner name="crescent" />}
        </div>
        {searchError && <p className="wiz-hint loss">Search failed. Try again.</p>}
        {trimmed && !searching && !searchError && results.length === 0 && (
          <p className="wiz-hint">No matches for "{trimmed}"</p>
        )}
        {trimmed && results.length > 0 && (
          <IonList inset>
            {results.map((r) => (
              <IonItem key={r.symbol} button detail onClick={() => pickSymbol(r.symbol, r.name ?? "")}>
                <IonLabel className="label-sym">
                  <h2>{r.symbol}</h2>
                  <p>{[r.name, r.exchange].filter(Boolean).join(" · ")}</p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}
        {!trimmed && owned.length > 0 && (
          <>
            <p className="wiz-hint">Or add to a holding</p>
            <IonList inset>
              {owned.map((t) => (
                <IonItem
                  key={t.symbol}
                  button
                  detail
                  onClick={() => pickSymbol(t.symbol, quotes[t.symbol]?.shortName ?? "")}
                >
                  <IonLabel className="label-sym">
                    <h2>{t.symbol}</h2>
                    {quotes[t.symbol]?.shortName && <p>{quotes[t.symbol].shortName}</p>}
                  </IonLabel>
                  {quotes[t.symbol] && (
                    <IonLabel slot="end">
                      <p className="wiz-row-fig">{fmtCcy(quotes[t.symbol].price, quotes[t.symbol].currency)}</p>
                    </IonLabel>
                  )}
                </IonItem>
              ))}
            </IonList>
          </>
        )}
      </>
    );
  } else if (step === "position") {
    // A Sell opened from one holding lists that holding's accounts first.
    const sorted = [...positions].sort(
      (a, b) =>
        Number(b.symbol === draft.symbol) - Number(a.symbol === draft.symbol) ||
        a.symbol.localeCompare(b.symbol) ||
        a.account.localeCompare(b.account),
    );
    body =
      sorted.length === 0 ? (
        <p className="wiz-hint">Nothing to sell yet — no account holds any shares.</p>
      ) : (
        <IonList inset>
          {sorted.map((p) => (
            <IonItem
              key={`${p.symbol}|${p.account}`}
              button
              detail
              onClick={() => pickSymbol(p.symbol, quotes[p.symbol]?.shortName ?? "", p.account)}
            >
              <IonLabel className="label-sym">
                <h2>{p.symbol}</h2>
                <p>{p.account}</p>
              </IonLabel>
              <IonLabel slot="end">
                <p className="wiz-row-fig">{fmtShares(p.shares)} sh</p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      );
  } else {
    body = (
      <form onSubmit={handleSave}>
        {isCash && (
          <IonSegment
            className="seg-card"
            value={cashMode}
            onIonChange={(e) => set({ cashMode: e.detail.value as CashMode })}
          >
            <IonSegmentButton value="deposit">
              <IonLabel>Deposit</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="withdraw">
              <IonLabel>Withdraw</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="set">
              <IonLabel>Set balance</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        )}
        {isSetBalance ? (
          <>
            <div className="wiz-total wiz-current">
              <span className="wiz-field-label">Current balance</span>
              <MoneyHero value={cashBalance ?? 0} currency={draft.currency} small />
            </div>
            <label className="wiz-field">
              <span className="wiz-field-label">New balance · {draft.currency}</span>
              <input
                ref={focusRef}
                inputMode="decimal"
                enterKeyHint="done"
                placeholder="0.00"
                value={draft.balance}
                onChange={(e) => set({ balance: cleanDecimal(e.target.value) })}
              />
            </label>
            {/* Says what will land in the ledger, since that row is what the
                Transactions tab will show for this change. */}
            <p className="wiz-hint">
              {savedDelta == null || !(Math.abs(balanceDelta ?? 0) > 0.004)
                ? "Saves the difference as a deposit or withdrawal, dated today."
                : Math.abs(savedDelta) <= 0.004
                  ? "Removes today's earlier balance update."
                  : `${sameDayUpdate ? "Replaces today's earlier update with" : "Saves"} a ${savedDelta > 0 ? "deposit" : "withdrawal"} of ${fmtCcy(Math.abs(savedDelta), draft.currency)}, dated today.`}
            </p>
          </>
        ) : isCash ? (
          <label className="wiz-field">
            <span className="wiz-field-label">Amount · {draft.currency}</span>
            <input
              ref={focusRef}
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0.00"
              value={draft.amount}
              onChange={(e) => set({ amount: cleanDecimal(e.target.value) })}
            />
            {type === "withdraw" && cashBalance != null && cashBalance > 0 && (
              <button type="button" className="wiz-quick" onClick={() => set({ amount: String(cashBalance) })}>
                All {fmtCcy(cashBalance, draft.currency)}
              </button>
            )}
          </label>
        ) : (
          <>
            <label className="wiz-field">
              <span className="wiz-field-label">Shares</span>
              <input
                ref={focusRef}
                inputMode="decimal"
                enterKeyHint="done"
                placeholder="0"
                value={draft.shares}
                onChange={(e) => set({ shares: cleanDecimal(e.target.value) })}
              />
              {type === "sell" && held > 0 && (
                <button type="button" className="wiz-quick" onClick={() => set({ shares: String(Number(held.toFixed(8))) })}>
                  All {fmtShares(held)}
                </button>
              )}
            </label>
            {overSold && <p className="wiz-hint loss">{draft.account} holds only {fmtShares(held)} sh.</p>}
            <label className="wiz-field">
              <span className="wiz-field-label">Price per share · {draft.currency}</span>
              <input
                inputMode="decimal"
                enterKeyHint="done"
                placeholder="0.00"
                value={draft.price}
                onChange={(e) => {
                  priceTouched.current = true;
                  set({ price: cleanDecimal(e.target.value) });
                }}
              />
              {market && draft.price !== priceText(market.price) && (
                <button type="button" className="wiz-quick" onClick={() => set({ price: priceText(market.price) })}>
                  Market {fmtCcy(market.price, market.currency)}
                </button>
              )}
            </label>
          </>
        )}

        <div className="wiz-opts">
          {/* A balance update is always as of today, and writes its own note. */}
          {!isSetBalance && (
            <button type="button" className="filter-chip on" onClick={() => setDateSheetOpen(true)}>
              {dateLabel}
              <ChevronDownIcon />
            </button>
          )}
          <button type="button" className="filter-chip on" onClick={() => setCurrencySheetOpen(true)}>
            {draft.currency}
            <ChevronDownIcon />
          </button>
          {!noteOpen && !isSetBalance && (
            <button type="button" className="filter-chip" onClick={() => setNoteOpen(true)}>
              + Note
            </button>
          )}
        </div>
        {noteOpen && !isSetBalance && (
          <div className="wiz-inline">
            <input
              className="wiz-text"
              placeholder="Add a note…"
              autoFocus
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        )}

        {total != null && (
          <div className="wiz-total">
            <span className="wiz-field-label">Total</span>
            <MoneyHero value={total} currency={draft.currency} small />
          </div>
        )}

        <div className="btn-stack">
          <button type="submit" className="btn btn-primary" disabled={!isValid || saving}>
            {isSetBalance
              ? "Set Balance"
              : `Add ${type === "withdraw" ? "Withdrawal" : type === "deposit" ? "Deposit" : kind ? KIND_LABEL[kind] : "Transaction"}`}
          </button>
        </div>
      </form>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            {/* Inside the wizard, Back is one step; on the step the wizard
                opened at it leaves, labelled by the parent screen like every
                other pushed page. IonBackButton spreads its props over its
                own click handler, so onClick replaces the router pop — its
                Props type just doesn't declare it. */}
            <IonBackButton
              defaultHref={tabBase}
              text={step === initial.step || stepIndex <= 0 ? tabLabel : "Back"}
              {...({ onClick: handleBack } as object)}
            />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <input ref={hoistRef} tabIndex={-1} aria-hidden="true" className="kb-hoist" inputMode="decimal" />

        <div className="wiz-progress">
          {/* The count is only known once the type is: a Sell is three steps,
              a Buy four. */}
          <span className="wiz-progress-label">
            Step {stepIndex + 1}
            {kind && ` of ${steps.length}`}
          </span>
          <div className="wiz-progress-bars" aria-hidden="true">
            {(kind ? steps : (["type", "account", "symbol", "details"] as StepId[])).map((s, i) => (
              <span key={s} className={i <= stepIndex ? "on" : undefined} />
            ))}
          </div>
        </div>

        <div className="wiz-crumbs">
          {crumbs.map((c) => (
            <button key={c.step} type="button" className={`wiz-crumb${c.step === "type" ? ` ${kind}` : ""}`} onClick={() => goTo(c.step)}>
              {c.label}
            </button>
          ))}
        </div>

        <div key={step} className="wiz-step">
          <h1 className="wiz-q">{question[step]}</h1>
          {step === "details" && !isCash && draft.symbolName && <p className="wiz-sub">{draft.symbolName}</p>}
          {body}
        </div>

        <DateSheet
          isOpen={dateSheetOpen}
          value={draft.date}
          onSelect={(date) => set({ date })}
          onClose={() => setDateSheetOpen(false)}
        />
        <PickerSheet
          mode="static"
          isOpen={currencySheetOpen}
          title="Currency"
          selected={draft.currency}
          onClose={() => setCurrencySheetOpen(false)}
          onSelect={(currency) => set({ currency })}
          options={currencyOptions}
        />
      </IonContent>
    </IonPage>
  );
}

export default AddTransactionWizardPage;
