import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import ActionSheetModal from "../components/ActionSheetModal";
import PickerSheet from "../components/PickerSheet";
import { TrashIcon } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useToast } from "../context/ToastContext";
import { CURRENCIES } from "../lib/currencies";

function currencyName(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.name ?? code;
}

// Update Balance (design-system Screens section): promoted from a sheet to a
// full page. Account and currency live only in the header — never as
// .field-card rows — so they never look editable next to the one row that
// actually is (Balance). Reached with an existing currency (edit: currency
// fixed, shown in the header, Delete Balance available) or without one
// (add: currency is picked via a field-card row, since there's nothing yet
// to put in the header, and there's nothing to delete).
function UpdateBalancePage({ match }: RouteComponentProps<{ accountId: string; currency?: string }>) {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const { accounts, loading, updateCashBalance } = usePortfolioData();
  const { showToast } = useToast();

  const account = accounts.find((a) => a.id === match.params.accountId);
  const editingCurrency = match.params.currency ?? null;
  const isEditing = editingCurrency !== null;

  const [selectedCurrency, setSelectedCurrency] = useState(editingCurrency ?? "");
  const [amount, setAmount] = useState("");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Snapshot for unsaved-changes detection, replaced once the account (and
  // any existing balance for editingCurrency) has loaded.
  const [baseline, setBaseline] = useState({ selectedCurrency, amount });

  useEffect(() => {
    if (!account) return;
    const existing = editingCurrency ? account.balances.find((b) => b.currency === editingCurrency) : undefined;
    const snapshot = {
      selectedCurrency: editingCurrency ?? "",
      amount: existing ? String(existing.balance) : "",
    };
    setSelectedCurrency(snapshot.selectedCurrency);
    setAmount(snapshot.amount);
    setBaseline(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCurrency, account?.id]);

  if (!account) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref={tabBase} text={tabLabel} />
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {loading.accounts ? (
            <div className="chart-loading">
              <IonSpinner name="crescent" />
            </div>
          ) : (
            <p>Account not found.</p>
          )}
        </IonContent>
      </IonPage>
    );
  }

  const availableCurrencies = CURRENCIES.filter((c) => !account.balances.some((b) => b.currency === c.code));
  const isValid = selectedCurrency.length > 0 && amount.trim().length > 0 && Number(amount) >= 0;
  const isDirty = selectedCurrency !== baseline.selectedCurrency || amount !== baseline.amount;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await updateCashBalance(account.id, selectedCurrency, Number(amount));
      showToast("Balance updated");
      history.goBack();
    } catch {
      showToast("Failed to update balance", { color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCurrency) return;
    try {
      await updateCashBalance(account.id, editingCurrency, 0);
      showToast("Balance deleted");
      history.goBack();
    } catch {
      showToast("Failed to delete balance", { color: "danger" });
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton
              defaultHref={
                account.type === "cash" ? `${tabBase}/cash-account/${account.id}` : `${tabBase}/account/${account.id}`
              }
              text="Back"
            />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div className="detail-hero">
          <div className="detail-symrow">
            <span className="detail-sym">{selectedCurrency || "New Balance"}</span>
            {selectedCurrency && <span className="detail-name">{currencyName(selectedCurrency)}</span>}
          </div>
          <div className="detail-name">{account.name}</div>
        </div>

        <IonList inset className="fieldcard-list form-list">
          {!isEditing && (
            <IonItem button detail onClick={() => setCurrencySheetOpen(true)}>
              <IonLabel>Currency</IonLabel>
              {/* key remounts the label on change — see AddTransactionPage (stale
                  text node when React patches ion-label's slotted text). */}
              <IonLabel
                slot="end"
                key={selectedCurrency || "placeholder"}
                color={selectedCurrency ? undefined : "medium"}
              >
                {selectedCurrency || "Select"}
              </IonLabel>
            </IonItem>
          )}
          <IonItem>
            <IonLabel>Balance</IonLabel>
            <IonInput
              slot="end"
              className="ion-text-end"
              type="number"
              inputmode="decimal"
              placeholder="0.00"
              value={amount}
              onIonInput={(e) => setAmount(e.detail.value ?? "")}
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
            Save Balance
          </button>
          {isEditing && (
            <button type="button" className="btn btn-destructive" onClick={() => setDeleteConfirmOpen(true)}>
              Delete Balance
            </button>
          )}
        </div>

        {!isEditing && (
          <PickerSheet
            mode="static"
            isOpen={currencySheetOpen}
            title="Currency"
            selected={selectedCurrency}
            options={availableCurrencies.map((c) => ({ value: c.code, label: c.code, sublabel: c.name }))}
            onClose={() => setCurrencySheetOpen(false)}
            onSelect={setSelectedCurrency}
          />
        )}

        <ActionSheetModal
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title="Delete Balance"
          subtitle="This cannot be undone"
          actions={[{ label: "Delete", icon: <TrashIcon />, destructive: true, onClick: handleDelete }]}
        />
      </IonContent>
    </IonPage>
  );
}

export default UpdateBalancePage;
