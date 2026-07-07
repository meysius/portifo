import {
  IonAvatar,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState } from "react";
import type { RefresherEventDetail } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import AddAccountModal from "../components/AddAccountModal";
import {
  CashGlyphIcon,
  ChevronRightIcon,
  EmptyState,
  FolderGlyphIcon,
  LedgerIcon,
  ListDivider,
  PlusIcon,
} from "../components/ds";
import { convert, fmtCcy } from "../lib/fx";

const DISPLAY_CCY = "USD";

// Accounts tab (design-system Lists section): same .row anatomy as Holdings —
// glyph, name + "Type · count" pairing, one converted total on the right, and
// the Fields chevron since each row opens an Account Detail page.
function AccountsPage() {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const {
    accounts,
    loading,
    refreshAccounts,
    refreshMarket,
    openPositionsFor,
    quotes,
    fxRates,
    tickerAggregates,
    hasActivity,
  } = usePortfolioData();
  const [addAccountOpen, setAddAccountOpen] = useState(false);

  const investmentAccounts = accounts.filter((a) => a.type === "investment");
  const cashAccounts = accounts.filter((a) => a.type === "cash");

  // Account totals are mark-to-market — make sure quotes for every open
  // symbol are loaded even when this tab is visited before Holdings.
  const symbolsKey = tickerAggregates
    .filter((t) => !t.closed)
    .map((t) => t.symbol)
    .join(",");

  useEffect(() => {
    if (symbolsKey) refreshMarket(symbolsKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await refreshAccounts();
    e.detail.complete();
  };

  // Total account value: holdings at market (falling back to cost basis when
  // no quote is loaded) plus the account's own cash, converted for display —
  // the same number its Account Detail hero shows.
  const investmentTotal = (accountName: string, balances: { currency: string; balance: number }[]) => {
    const positions = openPositionsFor(accountName);
    let total = balances.reduce((sum, b) => sum + convert(b.balance, b.currency, DISPLAY_CCY, fxRates), 0);
    for (const position of positions) {
      const quote = quotes[position.symbol];
      total += quote
        ? convert(quote.price * position.shares, quote.currency, DISPLAY_CCY, fxRates)
        : position.costByCurrency.reduce((sum, [ccy, amt]) => sum + convert(amt, ccy, DISPLAY_CCY, fxRates), 0);
    }
    return total;
  };

  return (
    <IonPage className="tab-root-page">
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Accounts</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Accounts</IonTitle>
            <button
              type="button"
              slot="end"
              className="add-fab"
              aria-label="Add account"
              onClick={() => setAddAccountOpen(true)}
            >
              <PlusIcon />
            </button>
          </IonToolbar>
        </IonHeader>

        {loading.accounts && accounts.length === 0 && (
          <div className="chart-loading">
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading.accounts && !hasActivity && (
          <EmptyState
            icon={<LedgerIcon />}
            title="No activity yet"
            body="Your investment and cash accounts are ready. Record a transaction or set a cash balance to see them here."
            ctaLabel="Add Your First Transaction"
            onCta={() => history.push(`${tabBase}/add-transaction`, { account: investmentAccounts[0]?.name })}
          />
        )}

        {hasActivity && investmentAccounts.length > 0 && (
          <>
            <ListDivider label="Investment" />
            <IonList inset>
              {investmentAccounts.map((account) => {
                const holdingCount = openPositionsFor(account.name).length;
                return (
                  <IonItem key={account.id} button detail={false} onClick={() => history.push(`${tabBase}/account/${account.id}`)}>
                    <IonAvatar slot="start" className="glyph glyph-stock">
                      <FolderGlyphIcon />
                    </IonAvatar>
                    <IonLabel className="sub-mono">
                      <h2>{account.name}</h2>
                      <p>
                        Investment · {holdingCount} holding{holdingCount === 1 ? "" : "s"}
                      </p>
                    </IonLabel>
                    <span slot="end" className="acct-val">
                      {fmtCcy(investmentTotal(account.name, account.balances), DISPLAY_CCY)}
                    </span>
                    <span slot="end" className="row-chevron" aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
                  </IonItem>
                );
              })}
            </IonList>
          </>
        )}

        {hasActivity && cashAccounts.length > 0 && (
          <>
            <ListDivider label="Cash" />
            <IonList inset>
              {cashAccounts.map((account) => {
                const total = account.balances.reduce(
                  (sum, b) => sum + convert(b.balance, b.currency, DISPLAY_CCY, fxRates),
                  0,
                );
                return (
                  <IonItem key={account.id} button detail={false} onClick={() => history.push(`${tabBase}/cash-account/${account.id}`)}>
                    <IonAvatar slot="start" className="glyph glyph-cash">
                      <CashGlyphIcon />
                    </IonAvatar>
                    <IonLabel className="sub-mono">
                      <h2>{account.name}</h2>
                      <p>
                        Cash · {account.balances.length} currenc{account.balances.length === 1 ? "y" : "ies"}
                      </p>
                    </IonLabel>
                    <span slot="end" className="acct-val">
                      {fmtCcy(total, DISPLAY_CCY)}
                    </span>
                    <span slot="end" className="row-chevron" aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
                  </IonItem>
                );
              })}
            </IonList>
          </>
        )}

        <AddAccountModal isOpen={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
      </IonContent>
    </IonPage>
  );
}

export default AccountsPage;
