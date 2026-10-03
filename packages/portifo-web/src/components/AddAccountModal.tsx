import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonToolbar } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useToast } from "../context/ToastContext";
import PickerSheet from "./PickerSheet";
import type { PickerOption } from "./PickerSheet";
import { ChevronDownIcon, CrossIcon } from "./ds";
import { CURRENCIES } from "../lib/currencies";
import { useDisplayCurrency } from "../lib/displayCurrency";
import { cleanDecimal, todayIso } from "../lib/forms";

type CashRow = { key: number; currency: string; amount: string };

const listFormat = new Intl.ListFormat(undefined, { type: "conjunction" });

// fmtCcy's narrow symbols print CAD and AUD as a bare "$", which can't tell a
// mixed-currency summary apart — the full symbol does ("$12,500.00 and CA$800.00").
const fmtDistinct = (amount: number, currency: string) =>
  amount.toLocaleString("en-US", { style: "currency", currency, currencyDisplay: "symbol" });

// The sheet has no title: the name field is the heading, set the way the
// account's own page title will read, so the account is seen being named.
// Cash is the one optional extra, one row per currency — each row saves
// through Set balance, so it lands in the ledger exactly as setting that
// currency's balance later from the account would.
function AddAccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { accounts, createAccount, setBalance } = usePortfolioData();
  const { showToast } = useToast();
  const [displayCurrency] = useDisplayCurrency();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<CashRow[]>([{ key: 0, currency: displayCurrency, amount: "" }]);
  // The row whose currency chip opened the picker.
  const [pickerRow, setPickerRow] = useState<number | null>(null);
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
  // Same case-insensitive rule the server enforces, caught before Save.
  const taken = accounts.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
  const isValid = trimmed.length > 0 && !taken;
  // Only rows with a positive amount are saved; an empty row is just skipped.
  const filled = rows
    .map((r) => ({ currency: r.currency, amount: Number(r.amount) }))
    .filter((r) => Number.isFinite(r.amount) && r.amount > 0);
  const unused = CURRENCIES.filter((c) => !rows.some((r) => r.currency === c.code));

  const updateRow = (key: number, patch: Partial<CashRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (unused.length === 0) return;
    const key = nextKey.current++;
    focusKey.current = key;
    setRows((prev) => [...prev, { key, currency: unused[0].code, amount: "" }]);
  };

  const removeRow = (key: number) => setRows((prev) => prev.filter((r) => r.key !== key));

  // A currency already on another row is left out, so no two rows can share one.
  const pickerOptions: PickerOption[] = CURRENCIES.filter(
    (c) => !rows.some((r) => r.key !== pickerRow && r.currency === c.code),
  ).map((c) => ({ value: c.code, label: c.code, sublabel: c.name }));

  const handleClose = () => {
    setName("");
    setRows([{ key: 0, currency: displayCurrency, amount: "" }]);
    setSaving(false);
    onClose();
  };

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!isValid || saving) return;
    setSaving(true);
    let accountId: string;
    try {
      accountId = (await createAccount({ name: trimmed })).id;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create account", { color: "danger" });
      setSaving(false);
      return;
    }
    // One at a time: each balance write also refreshes the account's ledger.
    const failed: string[] = [];
    for (const row of filled) {
      try {
        await setBalance(accountId, row.currency, row.amount, todayIso());
      } catch {
        failed.push(row.currency);
      }
    }
    if (failed.length > 0) {
      showToast(
        `${trimmed} was created without its ${listFormat.format(failed)} cash. Set the balance from the account.`,
        { color: "danger" },
      );
    } else {
      showToast("Account created");
    }
    handleClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleClose} onDidPresent={() => nameRef.current?.focus()}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleClose}>Cancel</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <form className="acct-form" onSubmit={handleSave}>
          <input
            ref={nameRef}
            className={`acct-name${taken ? " taken" : ""}`}
            aria-label="Account name"
            aria-invalid={!!taken}
            placeholder="Account name"
            autoCapitalize="words"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              amountRefs.current.get(rows[0].key)?.focus();
            }}
          />
          <p className={`wiz-hint${taken ? " loss" : ""}`}>
            {taken ? `You already have an account named ${taken.name}.` : "The broker, bank or wallet that holds the money."}
          </p>

          <div className="acct-cash" role="group" aria-labelledby="acct-cash-label">
            <span id="acct-cash-label" className="wiz-field-label">
              {rows.length > 1 ? "Cash balances" : "Cash balance"}
            </span>
            {rows.map((row) => (
              <div key={row.key} className={`wiz-field acct-cash-row${rows.length > 1 ? " removable" : ""}`}>
                <input
                  ref={(el) => {
                    if (el) amountRefs.current.set(row.key, el);
                    else amountRefs.current.delete(row.key);
                  }}
                  aria-label={`Cash balance in ${row.currency}`}
                  inputMode="decimal"
                  enterKeyHint="done"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, { amount: cleanDecimal(e.target.value) })}
                />
                <button
                  type="button"
                  className="filter-chip on"
                  aria-label={`Currency: ${row.currency}`}
                  onClick={() => setPickerRow(row.key)}
                >
                  {row.currency}
                  <ChevronDownIcon />
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="acct-cash-remove"
                    aria-label={`Remove ${row.currency}`}
                    onClick={() => removeRow(row.key)}
                  >
                    <CrossIcon />
                  </button>
                )}
              </div>
            ))}
            {unused.length > 0 && (
              <button type="button" className="filter-chip acct-cash-add" onClick={addRow}>
                + Add currency
              </button>
            )}
          </div>
          <p className="wiz-hint">
            {filled.length === 0
              ? "Optional. You can set it later from the account."
              : `Saves ${filled.length === 1 ? "a deposit" : "deposits"} of ${listFormat.format(
                  filled.map((r) => fmtDistinct(r.amount, r.currency)),
                )}, dated today.`}
          </p>

          <div className="btn-stack">
            <button type="submit" className="btn btn-primary" disabled={!isValid || saving}>
              Create Account
            </button>
          </div>
        </form>

        <PickerSheet
          mode="static"
          isOpen={pickerRow != null}
          title="Currency"
          selected={rows.find((r) => r.key === pickerRow)?.currency}
          onClose={() => setPickerRow(null)}
          onSelect={(currency) => {
            if (pickerRow != null) updateRow(pickerRow, { currency });
          }}
          options={pickerOptions}
        />
      </IonContent>
    </IonModal>
  );
}

export default AddAccountModal;
