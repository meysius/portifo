import { IonModal } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useToast } from "../context/ToastContext";
import { CURRENCIES } from "../lib/currencies";
import { useDisplayCurrency } from "../lib/displayCurrency";
import { todayIso } from "../lib/forms";

type Row = { key: number; currency: string };

const listFormat = new Intl.ListFormat(undefined, { type: "conjunction" });

const PLUS = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const CROSS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

// New account, from design-poc/accounts.html: a focused full-screen form, like
// the transaction wizard. A name is enough; opening cash is optional, one row
// per currency. Each balance saves through Set balance, so it lands in the
// ledger exactly as setting that currency's balance from the account later
// would: a deposit (or a withdrawal, for a negative balance) dated today.
function AddAccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { accounts, createAccount, setBalance } = usePortfolioData();
  const { showToast } = useToast();
  const [displayCurrency] = useDisplayCurrency();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([{ key: 0, currency: displayCurrency }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRefs = useRef(new Map<number, HTMLInputElement>());
  const nextKey = useRef(1);
  const focusKey = useRef<number | null>(null);

  // A row added with "Add currency" takes the cursor once it has mounted.
  useEffect(() => {
    if (focusKey.current == null) return;
    amountRefs.current.get(focusKey.current)?.focus();
    focusKey.current = null;
  }, [rows]);

  const trimmed = name.trim();
  // The server's rule, caught before Create: unique regardless of case.
  const taken = accounts.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
  const unused = CURRENCIES.filter((c) => !rows.some((r) => r.currency === c.code));

  const reset = () => {
    setName("");
    setRows([{ key: 0, currency: displayCurrency }]);
    setError("");
    setSaving(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const addRow = () => {
    if (!unused.length) return;
    const key = nextKey.current++;
    focusKey.current = key;
    setRows((prev) => [...prev, { key, currency: unused[0].code }]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) {
      setError("Please give this account a name.");
      nameRef.current?.focus();
      return;
    }
    if (taken) {
      setError(`You already have an account named ${taken.name}.`);
      return;
    }
    if (trimmed.length > 60) {
      setError("Use 60 characters or fewer for the account name.");
      return;
    }
    const entered: { currency: string; amount: number }[] = [];
    for (const row of rows) {
      const input = amountRefs.current.get(row.key);
      if (!input) continue;
      if (input.validity.badInput) {
        setError("Enter a valid cash balance below one trillion.");
        return;
      }
      if (input.value === "") continue;
      const amount = Number(input.value);
      if (!Number.isFinite(amount) || Math.abs(amount) >= 1e12) {
        setError("Enter a valid cash balance below one trillion.");
        return;
      }
      // A zero balance is no balance: nothing to record.
      if (amount !== 0) entered.push({ currency: row.currency, amount });
    }
    if (saving) return;
    setSaving(true);
    setError("");
    let accountId: string;
    try {
      accountId = (await createAccount({ name: trimmed })).id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t create the account. Try again.");
      setSaving(false);
      return;
    }
    // One at a time: each balance write also refreshes the account's ledger.
    const failed: string[] = [];
    for (const row of entered) {
      try {
        await setBalance(accountId, row.currency, row.amount, todayIso());
      } catch {
        failed.push(row.currency);
      }
    }
    showToast(
      failed.length
        ? `${trimmed} was created without its ${listFormat.format(failed)} cash. Set the balance from the account.`
        : "Account created",
      failed.length ? { color: "danger" } : undefined,
    );
    close();
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={close}
      onDidPresent={() => nameRef.current?.focus()}
      className="ds-screen ac-create-modal"
      aria-labelledby="ac-create-title"
    >
      <div className="ac-create">
        <header className="ac-form-navigation">
          <button type="button" className="ac-cancel" onClick={close}>
            Cancel
          </button>
          <h2 id="ac-create-title">New account</h2>
          <span className="ac-form-navigation-spacer" aria-hidden="true" />
        </header>
        <form className="ac-form" noValidate onSubmit={submit}>
          <div className="ac-form-body">
            <p className="ac-form-kicker">A new place for your money</p>
            <h3>Make it your own.</h3>
            <p className="ac-form-intro">
              Add the broker, bank or wallet you already use.
              <br />
              No connection or login needed.
            </p>
            <label className="ds-field-label" htmlFor="ac-account-name">
              Account name
            </label>
            <input
              ref={nameRef}
              id="ac-account-name"
              className="ds-field ac-name-field"
              placeholder="e.g. My TFSA"
              maxLength={60}
              autoCapitalize="words"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              aria-invalid={!!taken}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
            />
            <div className="ac-cash-heading">
              <h4>Opening cash</h4>
              <span className="ac-optional">Optional</span>
            </div>
            {rows.map((row, i) => (
              <div className="ac-balance-entry" key={row.key}>
                <input
                  ref={(el) => {
                    if (el) amountRefs.current.set(row.key, el);
                    else amountRefs.current.delete(row.key);
                  }}
                  className="ds-field"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  aria-label={`Opening cash balance ${i + 1}`}
                  onChange={() => setError("")}
                />
                <select
                  className="ds-field"
                  aria-label={`Cash currency ${i + 1}`}
                  value={row.currency}
                  onChange={(e) =>
                    setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, currency: e.target.value } : r)))
                  }
                >
                  {/* A currency on another row is left out, so no two rows share one. */}
                  {CURRENCIES.filter((c) => c.code === row.currency || !rows.some((r) => r.currency === c.code)).map(
                    (c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ),
                  )}
                </select>
                <button
                  type="button"
                  className="ac-remove-balance"
                  aria-label={`Remove cash balance ${i + 1}`}
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  {CROSS}
                </button>
              </div>
            ))}
            {unused.length > 0 && (
              <button type="button" className="ac-add-currency" onClick={addRow}>
                {PLUS}
                Add currency
              </button>
            )}
            <p className="ac-form-hint">
              Leave blank if you’re only tracking investments.
              <br />
              You can set cash balances later from the account.
            </p>
            {(error || taken) && (
              <p className="ds-form-error" role="alert">
                {error || `You already have an account named ${taken?.name}.`}
              </p>
            )}
          </div>
          <footer className="ac-form-footer">
            <button type="submit" className="ds-action" disabled={!trimmed || !!taken || saving}>
              Create account
            </button>
            <p>Opening cash is recorded as a deposit, dated today.</p>
          </footer>
        </form>
      </div>
    </IonModal>
  );
}

export default AddAccountModal;
