import {
  IonContent,
  IonHeader,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useMemo, useState } from "react";
import type { RefresherEventDetail } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import PickerSheet from "../components/PickerSheet";
import type { PickerOption } from "../components/PickerSheet";
import TransactionRow from "../components/TransactionRow";
import { EmptyState, LedgerIcon, ListDivider, PlusIcon } from "../components/ds";
import type { TransactionType } from "../api/portfolio";

const TYPE_LABEL: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  deposit: "Deposit",
  withdraw: "Withdraw",
};

const TYPE_ORDER: TransactionType[] = ["buy", "sell", "deposit", "withdraw"];

type FilterKey = "symbol" | "type" | "account";

function CaretDownIcon() {
  return (
    <svg viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* A chip states its DIMENSION when unset and its VALUE when set — the label
   above the value was saying what the value already says, and it was costing
   11pt of a 113pt box to do it. Chips size to their content and the row scrolls
   rather than truncating, so a long account name arrives whole. */
function FilterChip({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  const set = value !== "";
  return (
    <button
      type="button"
      className={`filter-chip${set ? " on" : ""}`}
      aria-label={set ? `${label}: ${value}` : `Filter by ${label.toLowerCase()}`}
      onClick={onClick}
    >
      {set ? value : label}
      <CaretDownIcon />
    </button>
  );
}

function TransactionsPage() {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const { accounts, transactions, realizedPLByTx, loading, refreshTransactions } = usePortfolioData();
  const firstInvestmentAccount = accounts.find((a) => a.type === "investment")?.name;

  const [symbolFilter, setSymbolFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const anyFilter = symbolFilter !== "" || typeFilter !== "" || accountFilter !== "";

  const symbolOptions: PickerOption[] = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) if (tx.symbol) set.add(tx.symbol);
    return [{ value: "", label: "All" }, ...Array.from(set).sort().map((s) => ({ value: s, label: s }))];
  }, [transactions]);

  const accountOptions: PickerOption[] = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) set.add(tx.account);
    return [{ value: "", label: "All" }, ...Array.from(set).sort().map((a) => ({ value: a, label: a }))];
  }, [transactions]);

  const typeOptions: PickerOption[] = [
    { value: "", label: "All" },
    ...TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
  ];

  const filtered = useMemo(() => {
    return transactions
      .filter((tx) => !symbolFilter || tx.symbol === symbolFilter)
      .filter((tx) => !typeFilter || tx.type === typeFilter)
      .filter((tx) => !accountFilter || tx.account === accountFilter)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [transactions, symbolFilter, typeFilter, accountFilter]);

  // Months are the only grouping — one .divider per calendar month, newest
  // first, with the count as its trailing meta (screens.html → Transactions).
  // `filtered` is already sorted newest-first, so a single pass keeps that order.
  const months = useMemo(() => {
    const out: { key: string; label: string; txs: typeof filtered }[] = [];
    for (const tx of filtered) {
      const d = new Date(`${tx.date}T00:00:00`);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const last = out[out.length - 1];
      if (last && last.key === key) last.txs.push(tx);
      else out.push({ key, label, txs: [tx] });
    }
    return out;
  }, [filtered]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await refreshTransactions();
    e.detail.complete();
  };

  return (
    <IonPage className="tab-root-page">
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Transactions</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Transactions</IonTitle>
            <button
              type="button"
              slot="end"
              className="add-fab"
              aria-label="Add transaction"
              onClick={() => history.push(`${tabBase}/add-transaction`)}
            >
              <PlusIcon />
            </button>
          </IonToolbar>
        </IonHeader>

        {transactions.length > 0 && (
          <div className="filter-row">
            {/* Only the dimensions scroll. Clear sits outside this box because
                it is an action on the row, not a fourth dimension — inside it,
                a long account name pushed it off the viewport entirely. */}
            <div className="filter-scroll">
              <FilterChip label="Symbol" value={symbolFilter} onClick={() => setOpenFilter("symbol")} />
              <FilterChip
                label="Type"
                value={typeFilter ? TYPE_LABEL[typeFilter as TransactionType] : ""}
                onClick={() => setOpenFilter("type")}
              />
              <FilterChip label="Account" value={accountFilter} onClick={() => setOpenFilter("account")} />
            </div>
            {/* Clear exists only while something is set — an always-present
                reset is chrome that says nothing on the state this screen
                opens in nearly every time. */}
            {anyFilter && (
              <button
                type="button"
                className="filter-chip filter-clear"
                onClick={() => {
                  setSymbolFilter("");
                  setTypeFilter("");
                  setAccountFilter("");
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {!loading.transactions && transactions.length === 0 && (
          <EmptyState
            icon={<LedgerIcon />}
            title="No transactions yet"
            body="This portfolio is empty. Add your first buy, sell, deposit, or withdrawal to start tracking it."
            ctaLabel="Add Your First Transaction"
            onCta={() => history.push(`${tabBase}/add-transaction`, { account: firstInvestmentAccount })}
          />
        )}

        {transactions.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={<LedgerIcon />}
            title="No matches"
            body="No transactions match these filters. Try widening the symbol, type, or account filter."
          />
        )}

        {months.map((m) => (
          <div key={m.key}>
            <ListDivider
              label={m.label}
              meta={`${m.txs.length} transaction${m.txs.length === 1 ? "" : "s"}`}
            />
            <IonList inset>
              {m.txs.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  realizedPL={realizedPLByTx.get(tx.id)}
                  onClick={() => history.push(`${tabBase}/transaction/${tx.id}`)}
                />
              ))}
            </IonList>
          </div>
        ))}

        <PickerSheet
          mode="static"
          isOpen={openFilter === "symbol"}
          title="Symbol"
          selected={symbolFilter}
          onClose={() => setOpenFilter(null)}
          onSelect={setSymbolFilter}
          options={symbolOptions}
          searchable
        />
        <PickerSheet
          mode="static"
          isOpen={openFilter === "type"}
          title="Type"
          selected={typeFilter}
          onClose={() => setOpenFilter(null)}
          onSelect={setTypeFilter}
          options={typeOptions}
        />
        <PickerSheet
          mode="static"
          isOpen={openFilter === "account"}
          title="Account"
          selected={accountFilter}
          onClose={() => setOpenFilter(null)}
          onSelect={setAccountFilter}
          options={accountOptions}
        />
      </IonContent>
    </IonPage>
  );
}

export default TransactionsPage;
