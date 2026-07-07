import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import ActionSheetModal from "../components/ActionSheetModal";
import DateSheet from "../components/DateSheet";
import PickerSheet from "../components/PickerSheet";
import { TrashIcon } from "../components/ds";
import type { PickerOption } from "../components/PickerSheet";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useToast } from "../context/ToastContext";
import { searchSymbols } from "../api/market";
import type { SymbolResult } from "../api/market";
import type { NewTransaction, TransactionType } from "../api/portfolio";
import { CURRENCIES } from "../lib/currencies";

type LocationState = { type?: TransactionType; symbol?: string; account?: string } | undefined;

const SYMBOL_DEBOUNCE_MS = 250;

// Handles both create (/add-transaction) and edit (/add-transaction/:transactionId).
// Edit mode wins over any create-mode location.state prefill (used by Holdings'
// "Buy"/"Add Cash" entry points).
function AddTransactionPage({ match, location }: RouteComponentProps<{ transactionId?: string }>) {
  const history = useHistory();
  const { accounts, transactions, createTransaction, updateTransaction, deleteTransaction } = usePortfolioData();
  const { showToast } = useToast();

  const editingId = match.params.transactionId;
  const editingTx = editingId ? transactions.find((t) => t.id === editingId) : undefined;
  const locationState = location.state as LocationState;

  // Shared with the baseline snapshot below so "no changes yet" compares the
  // exact same string rather than two separate `new Date().toISOString()`
  // calls (which can differ by a millisecond and falsely read as dirty).
  const initialDateRef = useRef(new Date().toISOString());

  const [type, setType] = useState<TransactionType>(locationState?.type ?? "buy");
  const [account, setAccount] = useState(locationState?.account ?? "");
  const [date, setDate] = useState(initialDateRef.current);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [symbol, setSymbol] = useState(locationState?.symbol ?? "");
  const [symbolName, setSymbolName] = useState("");
  const [symbolSheetOpen, setSymbolSheetOpen] = useState(false);
  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const amountInputRef = useRef<HTMLIonInputElement>(null);
  const sharesInputRef = useRef<HTMLIonInputElement>(null);
  const pricePerShareInputRef = useRef<HTMLIonInputElement>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Snapshot of the fields that count toward the save payload, used to detect
  // unsaved changes. Starts at the create-mode defaults and is replaced with
  // the loaded transaction's values once editingTx resolves.
  const [baseline, setBaseline] = useState({
    type,
    account,
    date,
    currency,
    symbol,
    shares,
    pricePerShare,
    amount,
    notes,
  });

  // Syncs the form once the transaction being edited is found — handles both
  // "already loaded at mount" and "arrives after" (transactions load
  // asynchronously in PortfolioDataContext).
  useEffect(() => {
    if (!editingTx) return;
    const snapshot = {
      type: editingTx.type,
      account: editingTx.account,
      date: editingTx.date.includes("T") ? editingTx.date : `${editingTx.date}T00:00:00`,
      currency: editingTx.currency,
      symbol: editingTx.symbol ?? "",
      shares: editingTx.shares != null ? String(editingTx.shares) : "",
      pricePerShare: editingTx.pricePerShare != null ? String(editingTx.pricePerShare) : "",
      amount: editingTx.amount != null ? String(editingTx.amount) : "",
      notes: editingTx.notes ?? "",
    };
    setType(snapshot.type);
    setAccount(snapshot.account);
    setDate(snapshot.date);
    setCurrency(snapshot.currency);
    setSymbol(snapshot.symbol);
    setShares(snapshot.shares);
    setPricePerShare(snapshot.pricePerShare);
    setAmount(snapshot.amount);
    setNotes(snapshot.notes);
    setBaseline(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTx?.id]);

  // Symbol search — ported from the retired SymbolPickerSheet's debounced
  // live-search logic, now feeding a generic async PickerSheet.
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolResults, setSymbolResults] = useState<SymbolResult[]>([]);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const [symbolError, setSymbolError] = useState(false);
  const symbolRequestId = useRef(0);

  useEffect(() => {
    if (!symbolSheetOpen) return;
    setSymbolQuery("");
    setSymbolResults([]);
    setSymbolError(false);
  }, [symbolSheetOpen]);

  useEffect(() => {
    if (!symbolSheetOpen) return;
    const trimmed = symbolQuery.trim();
    if (!trimmed) {
      setSymbolResults([]);
      setSymbolLoading(false);
      setSymbolError(false);
      return;
    }
    const id = ++symbolRequestId.current;
    setSymbolLoading(true);
    setSymbolError(false);
    const timer = setTimeout(async () => {
      try {
        const found = await searchSymbols(trimmed);
        if (symbolRequestId.current === id) setSymbolResults(found);
      } catch {
        if (symbolRequestId.current === id) setSymbolError(true);
      } finally {
        if (symbolRequestId.current === id) setSymbolLoading(false);
      }
    }, SYMBOL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [symbolQuery, symbolSheetOpen]);

  const symbolPickerOptions: PickerOption[] = symbolResults.map((r) => ({
    value: r.symbol,
    label: r.symbol,
    sublabel: [r.name, r.exchange].filter(Boolean).join(" · ") || undefined,
  }));

  const accountOptions: PickerOption[] = accounts
    .filter((a) => a.type === "investment")
    .map((a) => ({ value: a.name, label: a.name }));

  const currencyOptions: PickerOption[] = CURRENCIES.map((c) => ({ value: c.code, label: c.code, sublabel: c.name }));

  // Lets the whole ion-item row (not just the ion-input itself) act as the tap
  // target, matching the Account/Date/Symbol/Currency rows — cursor always
  // lands at the end regardless of where in the row the tap landed.
  //
  // These rows aren't `button` items (an ion-item[button] renders as a native
  // <button>, which can't validly wrap an ion-input's nested <input>), so they
  // get no ripple/activated background for free. CSS :active can't fill in
  // for it either — iOS Safari only honors :active on elements with a real
  // touchstart listener, which a React onClick doesn't provide. Pointer
  // events + this bit of state are the reliable cross-platform way to get
  // the same "tapped" feedback as the button rows.
  const [pressedField, setPressedField] = useState<string | null>(null);
  const pressHandlers = (field: string) => ({
    onPointerDown: () => setPressedField(field),
    onPointerUp: () => setPressedField((f) => (f === field ? null : f)),
    onPointerCancel: () => setPressedField((f) => (f === field ? null : f)),
    onPointerLeave: () => setPressedField((f) => (f === field ? null : f)),
  });

  const focusInputAtEnd = async (ref: RefObject<HTMLIonInputElement>) => {
    const native = await ref.current?.getInputElement();
    if (!native) return;
    native.focus();
    const end = native.value.length;
    native.setSelectionRange(end, end);
  };

  const isCashType = type === "deposit" || type === "withdraw";
  // pricePerShare may legitimately be 0 (e.g. RSU grants), so it's checked for
  // presence separately rather than folded into a truthy/">0" test.
  const isValid =
    account.trim().length > 0 &&
    (isCashType
      ? Number(amount) > 0
      : symbol.trim().length > 0 &&
        Number(shares) > 0 &&
        pricePerShare.trim().length > 0 &&
        Number(pricePerShare) >= 0);
  const isDirty =
    type !== baseline.type ||
    account !== baseline.account ||
    date !== baseline.date ||
    currency !== baseline.currency ||
    symbol !== baseline.symbol ||
    shares !== baseline.shares ||
    pricePerShare !== baseline.pricePerShare ||
    amount !== baseline.amount ||
    notes !== baseline.notes;

  const formattedDate = new Date(date.includes("T") ? date : `${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleSave = async () => {
    if (!isValid) return;
    const input: NewTransaction = {
      type,
      account: account.trim(),
      date: date.slice(0, 10),
      currency,
      ...(isCashType
        ? { amount: Number(amount) }
        : { symbol: symbol.trim().toUpperCase(), shares: Number(shares), pricePerShare: Number(pricePerShare) }),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    setSaving(true);
    try {
      if (editingId) await updateTransaction(editingId, input);
      else await createTransaction(input);
      showToast("Transaction saved");
      history.goBack();
    } catch {
      showToast("Failed to save transaction", { color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    try {
      await deleteTransaction(editingId);
      showToast("Transaction deleted");
      // Edit is reached through the read-only Transaction Detail screen; pop
      // both it and the now-dead detail page in one step.
      history.go(-2);
    } catch {
      showToast("Failed to delete transaction", { color: "danger" });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>Cancel</IonButton>
          </IonButtons>
          <IonTitle>{editingId ? "Edit Transaction" : "Add Transaction"}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonSegment
          value={type}
          onIonChange={(e) => setType(e.detail.value as TransactionType)}
          className="type-segment"
        >
          <IonSegmentButton value="buy">
            <IonLabel>Buy</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="sell">
            <IonLabel>Sell</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="deposit">
            <IonLabel>Deposit</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="withdraw">
            <IonLabel>Withdraw</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        <IonList inset className="fieldcard-list form-list">
          <IonItem button detail onClick={() => setAccountSheetOpen(true)}>
            <IonLabel>Account</IonLabel>
            {/* key forces a remount when the value changes — patching a bare text
                node inside the upgraded ion-label leaves the old node behind
                (Stencil slot bookkeeping vs React reconciliation). */}
            <IonLabel
              slot="end"
              key={account || "placeholder"}
              color={account ? undefined : "medium"}
              className="ion-text-end"
            >
              {account || "Select account"}
            </IonLabel>
          </IonItem>

          <IonItem button detail={false} onClick={() => setDateSheetOpen(true)}>
            <IonLabel>Date</IonLabel>
            <IonLabel slot="end" key={formattedDate}>
              {formattedDate}
            </IonLabel>
          </IonItem>
        </IonList>

        <IonList inset className="fieldcard-list form-list">
          {isCashType ? (
            <IonItem
              className={pressedField === "amount" ? "tap-target pressed" : "tap-target"}
              onClick={() => focusInputAtEnd(amountInputRef)}
              {...pressHandlers("amount")}
            >
              <IonLabel>Amount</IonLabel>
              <IonInput
                ref={amountInputRef}
                slot="end"
                className="ion-text-end"
                type="number"
                inputmode="decimal"
                placeholder="0.00"
                value={amount}
                onIonInput={(e) => setAmount(e.detail.value ?? "")}
              />
            </IonItem>
          ) : (
            <>
              <IonItem button detail onClick={() => setSymbolSheetOpen(true)}>
                <IonLabel>Symbol</IonLabel>
                <IonLabel
                  slot="end"
                  key={symbol || "placeholder"}
                  color={symbol ? undefined : "medium"}
                  className="ion-text-end"
                >
                  {symbol ? (
                    <>
                      <h3 className="symbol-picked">{symbol}</h3>
                      {symbolName && <p>{symbolName}</p>}
                    </>
                  ) : (
                    "Select symbol"
                  )}
                </IonLabel>
              </IonItem>
              <IonItem
                className={pressedField === "shares" ? "tap-target pressed" : "tap-target"}
                onClick={() => focusInputAtEnd(sharesInputRef)}
                {...pressHandlers("shares")}
              >
                <IonLabel>Shares</IonLabel>
                <IonInput
                  ref={sharesInputRef}
                  slot="end"
                  className="ion-text-end"
                  type="number"
                  inputmode="decimal"
                  placeholder="0"
                  value={shares}
                  onIonInput={(e) => setShares(e.detail.value ?? "")}
                />
              </IonItem>
              <IonItem
                className={pressedField === "pricePerShare" ? "tap-target pressed" : "tap-target"}
                onClick={() => focusInputAtEnd(pricePerShareInputRef)}
                {...pressHandlers("pricePerShare")}
              >
                <IonLabel>Price per Share</IonLabel>
                <IonInput
                  ref={pricePerShareInputRef}
                  slot="end"
                  className="ion-text-end"
                  type="number"
                  inputmode="decimal"
                  placeholder="0.00"
                  value={pricePerShare}
                  onIonInput={(e) => setPricePerShare(e.detail.value ?? "")}
                />
              </IonItem>
            </>
          )}

          <IonItem button detail onClick={() => setCurrencySheetOpen(true)}>
            <IonLabel>Currency</IonLabel>
            <IonLabel slot="end" key={currency}>
              {currency}
            </IonLabel>
          </IonItem>
        </IonList>

        <IonList inset className="fieldcard-list form-list">
          <IonItem>
            <IonTextarea
              label="Notes"
              labelPlacement="stacked"
              placeholder="Add a note…"
              autoGrow
              value={notes}
              onIonInput={(e) => setNotes(e.detail.value ?? "")}
            />
          </IonItem>
        </IonList>

        <div className="btn-stack">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isValid || !isDirty || saving}
            onClick={handleSave}
          >
            {editingId ? "Save Changes" : "Add Transaction"}
          </button>
          {editingId && (
            <button type="button" className="btn btn-destructive" onClick={() => setDeleteConfirmOpen(true)}>
              Delete Transaction
            </button>
          )}
        </div>

        <DateSheet isOpen={dateSheetOpen} value={date} onSelect={setDate} onClose={() => setDateSheetOpen(false)} />

        <PickerSheet
          mode="static"
          isOpen={accountSheetOpen}
          title="Account"
          selected={account}
          onClose={() => setAccountSheetOpen(false)}
          onSelect={setAccount}
          options={accountOptions}
          allowCreate
          createLabel={(q) => `+ New account "${q}"`}
        />

        <PickerSheet
          mode="static"
          isOpen={currencySheetOpen}
          title="Currency"
          selected={currency}
          onClose={() => setCurrencySheetOpen(false)}
          onSelect={setCurrency}
          options={currencyOptions}
        />

        <PickerSheet
          mode="async"
          isOpen={symbolSheetOpen}
          title="Symbol"
          selected={symbol}
          onClose={() => setSymbolSheetOpen(false)}
          onSelect={(value) => {
            const found = symbolResults.find((r) => r.symbol === value);
            setSymbol(value);
            setSymbolName(found?.name ?? "");
          }}
          query={symbolQuery}
          onQueryChange={setSymbolQuery}
          options={symbolPickerOptions}
          loading={symbolLoading}
          error={symbolError}
          placeholder="Search ticker or company (live)"
          emptyHint="Powered by Yahoo Finance — start typing to search."
        />

        <ActionSheetModal
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title="Delete Transaction"
          subtitle="This cannot be undone"
          actions={[{ label: "Delete", icon: <TrashIcon />, destructive: true, onClick: handleDelete }]}
        />
      </IonContent>
    </IonPage>
  );
}

export default AddTransactionPage;
