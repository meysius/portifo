import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import DsSheet from "../components/DsSheet";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useToast } from "../context/ToastContext";
import { BACK_ICON } from "../lib/backIcon";
import { CURRENCIES } from "../lib/currencies";
import { useDisplayCurrency } from "../lib/displayCurrency";
import { convert, DISPLAY_CURRENCIES, fmtCcy, fmtShares, fmtSignedCcy, fmtSignedPct } from "../lib/fx";
import { todayIso } from "../lib/forms";
import { useHeadingScrolledAway } from "../lib/useHeadingScrolledAway";

// An account, one level deeper (design-poc/accounts.html). Its total leads,
// then what it is made of — investments and cash — then the holdings ledger
// and the cash in its own currencies. A cash row sets that balance in place;
// a holding opens the holding itself.

const icon = (body: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {body}
  </svg>
);
const ICONS = {
  plus: icon(<path d="M12 5v14M5 12h14" />),
  right: icon(<path d="m9 6 6 6-6 6" />, 14),
  down: icon(<path d="m6 9 6 6 6-6" />, 12),
  edit: icon(<path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-3-3L5 16l-1 4Z" />, 17),
  cash: icon(
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </>,
    18,
  ),
  wallet: icon(
    <>
      <path d="M4 5h13l4 4v10H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M16 13h5" />
    </>,
    18,
  ),
};

const currencyName = (code: string) => CURRENCIES.find((c) => c.code === code)?.name ?? code;
const tone = (n: number) => (n > 1e-9 ? "positive" : n < -1e-9 ? "negative" : "");
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

type CashSheet = { open: boolean; currency: string | null; key: number };

function AccountDetailPage({ match }: RouteComponentProps<{ accountId: string }>) {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const { accounts, loading, openPositionsFor, quotes, fxRates, refreshMarket, renameAccount, setBalance } =
    usePortfolioData();
  const { showToast } = useToast();
  const [ccy, setCcy] = useDisplayCurrency();
  const account = accounts.find((a) => a.id === match.params.accountId);
  const { headingRef, away, onIonScroll } = useHeadingScrolledAway<HTMLDivElement>();

  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [cash, setCash] = useState<CashSheet>({ open: false, currency: null, key: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const positions = account ? openPositionsFor(account.name) : [];
  const symbolsKey = positions.map((p) => p.symbol).join(",");
  useEffect(() => {
    if (symbolsKey) refreshMarket(symbolsKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  const header = (title: string, actions?: ReactNode) => (
    <IonHeader className={`ac-detail-header${away ? " collapsed" : ""}`}>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref={tabBase} text={tabLabel} icon={BACK_ICON} />
        </IonButtons>
        <IonTitle>{title}</IonTitle>
        {actions}
      </IonToolbar>
    </IonHeader>
  );

  if (!account) {
    return (
      <IonPage className="ds-screen ac-page ac-detail-page">
        {header("")}
        <IonContent>
          {!loading.accounts && (
            <section className="ac-empty">
              <div className="ac-empty-symbol">{ICONS.wallet}</div>
              <h2>No account found</h2>
              <p>It may have been removed, or this link may be out of date.</p>
            </section>
          )}
        </IonContent>
      </IonPage>
    );
  }

  const holdings = positions
    .map((p) => {
      const q = quotes[p.symbol];
      const cost = p.costByCurrency.reduce((sum, [c, amount]) => sum + convert(amount, c, ccy, fxRates), 0);
      const value = q ? convert(q.price * p.shares, q.currency, ccy, fxRates) : cost;
      const gain = q ? value - cost : null;
      return { symbol: p.symbol, name: q?.shortName, shares: p.shares, value, gain, cost, quoted: !!q };
    })
    .sort((a, b) => b.value - a.value);
  const investments = holdings.reduce((sum, h) => sum + h.value, 0);
  const cashTotal = account.balances.reduce((sum, b) => sum + convert(b.balance, b.currency, ccy, fxRates), 0);
  const total = investments + cashTotal;
  const empty = !holdings.length && !account.balances.length;
  const converted =
    account.balances.some((b) => b.currency !== ccy) ||
    positions.some((p) => (quotes[p.symbol]?.currency ?? p.costByCurrency[0]?.[0] ?? ccy) !== ccy);
  const heldCurrencies = account.balances.map((b) => b.currency);
  const addable = CURRENCIES.filter((c) => !heldCurrencies.includes(c.code));
  const editing = cash.currency ? account.balances.find((b) => b.currency === cash.currency) : undefined;

  const openCash = (currency: string | null) => {
    setError("");
    setCash((c) => ({ open: true, currency, key: c.key + 1 }));
  };
  const openRename = () => {
    setError("");
    setRenameOpen(true);
  };

  const submitRename = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name || name.length > 60) {
      setError("Enter an account name, up to 60 characters.");
      return;
    }
    if (accounts.some((a) => a.id !== account.id && a.name.toLowerCase() === name.toLowerCase())) {
      setError(`You already have an account named ${name}.`);
      return;
    }
    if (name === account.name) {
      setRenameOpen(false);
      return;
    }
    setSaving(true);
    try {
      await renameAccount(account.id, name);
      setRenameOpen(false);
      showToast("Account renamed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t rename the account. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const submitCash = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const currency = cash.currency ?? String(new FormData(form).get("currency") ?? "");
    const input = form.elements.namedItem("amount") as HTMLInputElement;
    const amount = Number(input.value);
    if (input.validity.badInput || input.value === "" || !Number.isFinite(amount) || Math.abs(amount) >= 1e12) {
      setError("Enter a valid cash balance below one trillion.");
      return;
    }
    setSaving(true);
    try {
      await setBalance(account.id, currency, amount, todayIso());
      setCash((c) => ({ ...c, open: false }));
      showToast("Cash balance updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t update the balance. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage className="ds-screen ac-page ac-detail-page">
      {header(
        account.name,
        <button type="button" slot="end" className="ds-icon-button quiet" aria-label="Rename account" onClick={openRename}>
          {ICONS.edit}
        </button>,
      )}

      <IonContent scrollEvents onIonScroll={onIonScroll}>
        <div className="ac-heading" ref={headingRef}>
          <h1>{account.name}</h1>
        </div>
        <p className="ac-subtitle">
          {holdings.length ? plural(holdings.length, "holding") : account.balances.length ? "Cash account" : "New account"} ·
          Manually tracked
        </p>

        <section className="ac-hero" aria-label="Total account value">
          <div className="ac-hero-label">Total account value</div>
          <div className="ac-hero-row">
            <span className="ac-hero-value money">{fmtCcy(total, ccy)}</span>
            <button
              type="button"
              className="ac-currency-chip"
              aria-label={`Display currency: ${ccy}`}
              onClick={() => setCurrencyOpen(true)}
            >
              {ccy}
              {ICONS.down}
            </button>
          </div>
        </section>

        {/* Only when there are both: a cash-only account would print
            "Investments $0.00" beside its own total. */}
        {holdings.length > 0 && account.balances.length > 0 && (
          <div className="ac-balance-split">
            <div>
              <span className="ac-metric-label">Investments</span>
              <span className="money">{fmtCcy(investments, ccy)}</span>
            </div>
            <div>
              <span className="ac-metric-label">Cash</span>
              <span className="money">{fmtCcy(cashTotal, ccy)}</span>
            </div>
          </div>
        )}

        {holdings.length > 0 && (
          <section className="ac-section">
            <div className="ac-section-heading">
              <h2>Holdings</h2>
              <span className="meta">Value / total return</span>
            </div>
            {holdings.map((h) => (
              <button
                key={h.symbol}
                type="button"
                className="ac-holding-row"
                onClick={() => history.push(`${tabBase}/asset/${encodeURIComponent(h.symbol)}`)}
              >
                <span className="ac-holding-line">
                  <span className="ac-holding-symbol">{h.symbol}</span>
                  <span className="ac-holding-value money">{fmtCcy(h.value, ccy)}</span>
                </span>
                {h.name && <span className="ac-holding-meta">{h.name}</span>}
                <span className="ac-holding-return">
                  <span>
                    {fmtShares(h.shares)} {h.shares === 1 ? "share" : "shares"}
                  </span>
                  {h.gain != null ? (
                    <span className={`money ${tone(h.gain)}`}>
                      {fmtSignedCcy(h.gain, ccy)}
                      {h.cost > 1e-9 && ` · ${fmtSignedPct((h.gain / h.cost) * 100)}`}
                    </span>
                  ) : (
                    <span>{loading.market ? " " : "At cost · no quote"}</span>
                  )}
                </span>
              </button>
            ))}
          </section>
        )}

        {empty && (
          <section className="ac-empty">
            <div className="ac-empty-symbol">{ICONS.wallet}</div>
            <h2>Nothing here. Yet.</h2>
            <p>Set a cash balance below. Investments appear when you record a buy against this account.</p>
          </section>
        )}

        <section className="ac-section">
          <div className="ac-section-heading">
            <h2>Cash</h2>
            {addable.length > 0 && (
              <button type="button" className="ds-icon-button" aria-label="Add a cash balance" onClick={() => openCash(null)}>
                {ICONS.plus}
              </button>
            )}
          </div>
          {account.balances.map((b) => (
            <button key={b.currency} type="button" className="ac-cash-row" onClick={() => openCash(b.currency)}>
              <span className="ac-account-icon cash">{ICONS.cash}</span>
              <span className="ac-cash-identity">
                <span className="ac-holding-symbol">{b.currency}</span>
                <span className="ac-holding-meta">{currencyName(b.currency)}</span>
              </span>
              <span className="money">{fmtCcy(b.balance, b.currency)}</span>
              <span className="ac-row-chevron">{ICONS.right}</span>
            </button>
          ))}
          <p className="ac-cash-note">
            {account.balances.length
              ? "Cash is shown in its original currency. Tap a balance to update it."
              : "No cash balance recorded. Add a currency whenever you’re ready."}
          </p>
        </section>

        {converted && <p className="ac-footer-note">Total value uses today’s exchange rates.</p>}

        {/* ── sheets ───────────────────────────────────────────────────── */}
        <DsSheet isOpen={renameOpen} onClose={() => setRenameOpen(false)} title="Rename account" titleId="ac-rename-title">
          <form noValidate onSubmit={submitRename} key={String(renameOpen)}>
            <label className="ds-field-label" htmlFor="ac-rename-name">
              Account name
            </label>
            <input
              id="ac-rename-name"
              name="name"
              className="ds-field"
              maxLength={60}
              autoComplete="off"
              autoCapitalize="words"
              defaultValue={account.name}
              onChange={() => setError("")}
            />
            {error && (
              <p className="ds-form-error" role="alert">
                {error}
              </p>
            )}
            <p className="ds-sheet-notice">This won’t change your holdings or cash balances.</p>
            <button type="submit" className="ds-action" disabled={saving}>
              Save changes
            </button>
          </form>
        </DsSheet>

        <DsSheet
          isOpen={cash.open}
          onClose={() => setCash((c) => ({ ...c, open: false }))}
          title={cash.currency ? "Set cash balance" : "Add cash balance"}
          titleId="ac-cash-title"
        >
          <form noValidate onSubmit={submitCash} key={cash.key}>
            <p className="ds-sheet-notice">
              {account.name}
              <br />
              Set the current balance, not the amount of a deposit.
            </p>
            <label className="ds-field-label" htmlFor="ac-cash-currency">
              Currency
            </label>
            <select
              id="ac-cash-currency"
              name="currency"
              className="ds-field"
              disabled={!!cash.currency}
              defaultValue={cash.currency ?? addable[0]?.code}
            >
              {(cash.currency ? CURRENCIES.filter((c) => c.code === cash.currency) : addable).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
            <label className="ds-field-label" htmlFor="ac-cash-amount">
              Current cash balance
            </label>
            <input
              id="ac-cash-amount"
              name="amount"
              className="ds-field"
              type="number"
              step="0.01"
              placeholder="0.00"
              defaultValue={editing ? editing.balance.toFixed(2) : ""}
              onChange={() => setError("")}
            />
            {error && (
              <p className="ds-form-error" role="alert">
                {error}
              </p>
            )}
            <p className="ds-sheet-notice">
              Negative balances are supported. Saving records the difference as a deposit or withdrawal, dated today.
            </p>
            <button type="submit" className="ds-action" disabled={saving}>
              Save balance
            </button>
          </form>
        </DsSheet>

        <DsSheet isOpen={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Display currency" titleId="ac-ccy-title">
          <p className="ds-sheet-notice">
            Totals and investments are converted to this currency across the app. Cash balances stay in their original
            currency.
          </p>
          <div className="ds-sheet-options">
            {DISPLAY_CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`ds-sheet-option${c === ccy ? " active" : ""}`}
                aria-pressed={c === ccy}
                onClick={() => {
                  setCcy(c);
                  setCurrencyOpen(false);
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="ds-sheet-notice">Converted at today’s exchange rates.</p>
        </DsSheet>
      </IonContent>
    </IonPage>
  );
}

export default AccountDetailPage;
