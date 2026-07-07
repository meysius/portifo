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
import { ChevronRightIcon, EmptyState, LedgerIcon, PlusIcon } from "../components/ds";
import type { TransactionType } from "../api/portfolio";

const TYPE_LABEL: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  deposit: "Deposit",
  withdraw: "Withdraw",
};

const TYPE_ORDER: TransactionType[] = ["buy", "sell", "deposit", "withdraw"];

type FilterKey = "symbol" | "type" | "account";

function FilterChip({ label, display, onClick }: { label: string; display: string; onClick: () => void }) {
  return (
    <button type="button" className="filter-chip" onClick={onClick}>
      <span className="filter-chip-text">
        <span className="filter-chip-label">{label}</span>
        <span className="filter-chip-val">{display}</span>
      </span>
      <ChevronRightIcon />
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
            <FilterChip label="Symbol" display={symbolFilter || "All"} onClick={() => setOpenFilter("symbol")} />
            <FilterChip
              label="Type"
              display={typeFilter ? TYPE_LABEL[typeFilter as TransactionType] : "All"}
              onClick={() => setOpenFilter("type")}
            />
            <FilterChip label="Account" display={accountFilter || "All"} onClick={() => setOpenFilter("account")} />
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

        {filtered.length > 0 && (
          <IonList inset>
            {filtered.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                realizedPL={realizedPLByTx.get(tx.id)}
                onClick={() => history.push(`${tabBase}/transaction/${tx.id}`)}
              />
            ))}
          </IonList>
        )}

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
