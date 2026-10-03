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
  PlusIcon,
} from "../components/ds";
import { convert, fmtCcy } from "../lib/fx";

const DISPLAY_CCY = "USD";

// Accounts tab (design-system Lists section): same .row anatomy as Holdings —
// glyph, name + what it holds, one converted total on the right, and the
// Fields chevron since each row opens an Account Detail page. One list: every
// account can hold both shares and cash, so there are no type sections.
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
  const accountTotal = (accountName: string, balances: { currency: string; balance: number }[]) => {
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
            body="Your account is ready. Record a transaction or set a cash balance to see it here."
            ctaLabel="Add Your First Transaction"
            onCta={() => history.push(`${tabBase}/add-transaction`)}
          />
        )}

        {hasActivity && accounts.length > 0 && (
          <IonList inset>
            {accounts.map((account) => {
              const holdingCount = openPositionsFor(account.name).length;
              const currencies = account.balances.map((b) => b.currency);
              return (
                <IonItem key={account.id} button detail={false} onClick={() => history.push(`${tabBase}/account/${account.id}`)}>
                  {/* The glyph says what the account mostly holds — there is
                      no account type behind it any more. */}
                  <IonAvatar slot="start" className={holdingCount > 0 ? "glyph glyph-stock" : "glyph glyph-cash"}>
                    {holdingCount > 0 ? <FolderGlyphIcon /> : <CashGlyphIcon />}
                  </IonAvatar>
                  <IonLabel>
                    <h2>{account.name}</h2>
                    <p>
                      {holdingCount > 0
                        ? `${holdingCount} holding${holdingCount === 1 ? "" : "s"}`
                        : currencies.length > 0
                          ? "Cash only"
                          : "Empty"}
                    </p>
                  </IonLabel>
                  <IonLabel slot="end">
                    <h2>{fmtCcy(accountTotal(account.name, account.balances), DISPLAY_CCY)}</h2>
                    {currencies.length > 0 && <p>{currencies.join(" · ")} cash</p>}
                  </IonLabel>
                  <span slot="end" className="row-chevron" aria-hidden="true">
                    <ChevronRightIcon />
                  </span>
                </IonItem>
              );
            })}
          </IonList>
        )}

        <AddAccountModal isOpen={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
      </IonContent>
    </IonPage>
  );
}

export default AccountsPage;
