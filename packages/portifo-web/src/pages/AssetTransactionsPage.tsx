import { IonBackButton, IonButtons, IonContent, IonHeader, IonList, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import { useMemo } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import TransactionRow from "../components/TransactionRow";
import { ListDivider } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";

// One holding's trades, pushed from Holding Detail ("View sales", or an exited
// account's "View transactions"). It stays inside the current tab's stack
// (rather than jumping to the Transactions tab with a filter set) so Back
// returns to the holding. `?account=` narrows it to one account and
// `?type=sell` to the sales.
function AssetTransactionsPage({ match, location }: RouteComponentProps<{ symbol: string }>) {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const symbol = match.params.symbol;
  const { transactions, realizedPLByTx } = usePortfolioData();
  const params = new URLSearchParams(location.search);
  const account = params.get("account");
  const type = params.get("type");
  const title = type === "sell" ? "Sales" : "Transactions";

  const months = useMemo(() => {
    const out: { key: string; label: string; txs: typeof transactions }[] = [];
    const rows = transactions
      .filter((tx) => tx.symbol === symbol && (!account || tx.account === account) && (!type || tx.type === type))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    for (const tx of rows) {
      const d = new Date(`${tx.date}T00:00:00`);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const last = out[out.length - 1];
      if (last && last.key === key) last.txs.push(tx);
      else out.push({ key, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), txs: [tx] });
    }
    return out;
  }, [transactions, symbol, account, type]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`${tabBase}/asset/${encodeURIComponent(symbol)}`} text={symbol} />
          </IonButtons>
          <IonTitle>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{title}</IonTitle>
          </IonToolbar>
        </IonHeader>
        {months.map((m) => (
          <div key={m.key}>
            <ListDivider label={m.label} meta={`${m.txs.length} transaction${m.txs.length === 1 ? "" : "s"}`} />
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
      </IonContent>
    </IonPage>
  );
}

export default AssetTransactionsPage;
