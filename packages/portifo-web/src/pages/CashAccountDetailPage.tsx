import {
  IonAvatar,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  IonToolbar,
} from "@ionic/react";
import { useState } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import CurrencyPickerSheet from "../CurrencyPickerSheet";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import {
  CashGlyphIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EmptyState,
  ListDivider,
  MoneyHero,
} from "../components/ds";
import { CURRENCIES } from "../lib/currencies";
import { convert, fmtCcy } from "../lib/fx";

function currencyName(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.name ?? code;
}

// Cash Account Detail (design-system Screens section): the same Currency
// Balances shape as an Investment Account's Cash section, promoted to the
// whole screen — hero total, a divider with the one brass add button, and
// chevron rows opening Update Balance. No stat grid: there's nothing to put
// in it besides what the hero already says.
function CashAccountDetailPage({ match }: RouteComponentProps<{ accountId: string }>) {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const { accounts, loading, fxRates } = usePortfolioData();
  const account = accounts.find((a) => a.id === match.params.accountId);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);

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

  const totalDisplay = account.balances.reduce(
    (sum, b) => sum + convert(b.balance, b.currency, displayCurrency, fxRates),
    0,
  );

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
            <span className="detail-sym">{account.name}</span>
          </div>
          <IonNote className="eyebrow">Total Value</IonNote>
          <div className="hero-row">
            <MoneyHero value={totalDisplay} currency={displayCurrency} small />
            <button type="button" className="currency-chip" onClick={() => setCurrencySheetOpen(true)}>
              {displayCurrency}
              <ChevronDownIcon />
            </button>
          </div>
        </div>

        {/* When empty, the empty state's brass CTA is the screen's one brass
            element — the divider's add button would be a second. */}
        <ListDivider
          label="Currency Balances"
          addLabel="Add currency balance"
          onAdd={account.balances.length > 0 ? () => history.push(`${tabBase}/update-balance/${account.id}`) : undefined}
        />
        {account.balances.length === 0 ? (
          <EmptyState
            icon={<CashGlyphIcon />}
            title="No balances yet"
            body="Add a currency to start tracking cash in this account."
            ctaLabel="Add a Currency"
            onCta={() => history.push(`${tabBase}/update-balance/${account.id}`)}
          />
        ) : (
          <IonList inset>
            {account.balances.map((balance) => (
              <IonItem
                key={balance.currency}
                button
                detail={false}
                onClick={() => history.push(`${tabBase}/update-balance/${account.id}/${balance.currency}`)}
              >
                <IonAvatar slot="start" className="glyph glyph-cash">
                  <CashGlyphIcon />
                </IonAvatar>
                <IonLabel className="label-sym sub-mono">
                  <h2>{balance.currency}</h2>
                  <p>{currencyName(balance.currency)}</p>
                </IonLabel>
                <IonLabel slot="end">
                  <h2>{fmtCcy(balance.balance, balance.currency)}</h2>
                </IonLabel>
                <span slot="end" className="row-chevron" aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </IonItem>
            ))}
          </IonList>
        )}

        <CurrencyPickerSheet
          isOpen={currencySheetOpen}
          selected={displayCurrency}
          onClose={() => setCurrencySheetOpen(false)}
          onSelect={setDisplayCurrency}
        />
      </IonContent>
    </IonPage>
  );
}

export default CashAccountDetailPage;
