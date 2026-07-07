import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonToolbar,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { fmtCcy, fmtShares } from "../lib/fx";
import type { TransactionType } from "../api/portfolio";

const TYPE_LABEL: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  deposit: "Deposit",
  withdraw: "Withdraw",
};

function formatDate(iso: string) {
  return new Date(iso.includes("T") ? iso : `${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Read-only Transaction Detail (design-system Screens section): opening a
// transaction to look at it can never change it. Every field-card row is
// chevron-less — nothing here is tappable — and editing is one explicit,
// separate action that hands off to the Add/Edit Transaction form pre-filled.
function TransactionDetailPage({ match }: RouteComponentProps<{ transactionId: string }>) {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const { transactions, loading } = usePortfolioData();
  const tx = transactions.find((t) => t.id === match.params.transactionId);

  if (!tx) {
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
          {loading.transactions ? (
            <div className="chart-loading">
              <IonSpinner name="crescent" />
            </div>
          ) : (
            <p>Transaction not found.</p>
          )}
        </IonContent>
      </IonPage>
    );
  }

  const isCashType = tx.type === "deposit" || tx.type === "withdraw";
  const dateStr = formatDate(tx.date);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={tabBase} text={tabLabel} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div className="detail-hero">
          <div className="detail-symrow">
            <span className="detail-sym">{isCashType ? "Cash" : tx.symbol}</span>
            <span className="type-tag">{TYPE_LABEL[tx.type]}</span>
          </div>
          <div className="detail-name">
            {tx.account} · {dateStr}
          </div>
        </div>

        <IonList inset className="fieldcard-list form-list">
          <IonItem>
            <IonLabel>Account</IonLabel>
            <IonLabel slot="end">{tx.account}</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Date</IonLabel>
            <IonLabel slot="end">{dateStr}</IonLabel>
          </IonItem>
          {isCashType ? (
            <>
              <IonItem>
                <IonLabel>Amount</IonLabel>
                <IonLabel slot="end">{fmtCcy(tx.amount ?? 0, tx.currency)}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Currency</IonLabel>
                <IonLabel slot="end">{tx.currency}</IonLabel>
              </IonItem>
            </>
          ) : (
            <>
              <IonItem>
                <IonLabel>Shares</IonLabel>
                <IonLabel slot="end">{fmtShares(tx.shares ?? 0)}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Price / Share</IonLabel>
                <IonLabel slot="end">{fmtCcy(tx.pricePerShare ?? 0, tx.currency)}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Total</IonLabel>
                <IonLabel slot="end">{fmtCcy((tx.shares ?? 0) * (tx.pricePerShare ?? 0), tx.currency)}</IonLabel>
              </IonItem>
            </>
          )}
        </IonList>

        {tx.notes && (
          <IonList inset className="fieldcard-list form-list">
            <IonItem lines="none" className="ion-text-wrap">
              <IonLabel>
                <p className="eyebrow">Notes</p>
                <p>{tx.notes}</p>
              </IonLabel>
            </IonItem>
          </IonList>
        )}

        <div className="btn-stack">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => history.push(`${tabBase}/add-transaction/${tx.id}`)}
          >
            Edit Transaction
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default TransactionDetailPage;
