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
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useState } from "react";
import { useHistory } from "react-router-dom";
import CurrencyPickerSheet from "../CurrencyPickerSheet";
import {
  CashGlyphIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EmptyState,
  ListDivider,
  MoneyHero,
} from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { convert, fmtCcy } from "../lib/fx";

// Aggregate cash view: investment accounts' own leftover cash + dedicated
// cash accounts. Total is derived from the same `cashByCurrency` value
// HoldingsPage's Cash row uses, so the two totals can never diverge. One row
// per account (multi-currency balances rolled up and converted to the
// selected display currency) — every row opens that account's detail page.
function CashDetailPage() {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const { accounts, cashByCurrency, fxRates } = usePortfolioData();
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);

  const total = Object.entries(cashByCurrency).reduce(
    (sum, [currency, amount]) => sum + convert(amount, currency, displayCurrency, fxRates),
    0,
  );

  const investmentAccounts = accounts.filter((a) => a.type === "investment" && a.balances.length > 0);
  const cashAccounts = accounts.filter((a) => a.type === "cash");

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={tabBase} text={tabLabel} />
          </IonButtons>
          <IonTitle>Cash</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div className="portfolio-summary">
          <IonNote className="eyebrow">Total Cash</IonNote>
          <div className="hero-row">
            <MoneyHero value={total} currency={displayCurrency} small />
            <button type="button" className="currency-chip" onClick={() => setCurrencySheetOpen(true)}>
              {displayCurrency}
              <ChevronDownIcon />
            </button>
          </div>
        </div>

        {investmentAccounts.length === 0 && cashAccounts.length === 0 && (
          <EmptyState
            icon={<CashGlyphIcon />}
            title="No cash yet"
            body="Deposit cash into an account or add a cash account to see balances here."
          />
        )}

        {investmentAccounts.length > 0 && (
          <>
            <ListDivider label="In Investment Accounts" />
            <IonList inset>
              {investmentAccounts.map((account) => {
                const accountTotal = account.balances.reduce(
                  (sum, b) => sum + convert(b.balance, b.currency, displayCurrency, fxRates),
                  0,
                );
                return (
                  <IonItem
                    key={account.id}
                    button
                    detail={false}
                    onClick={() => history.push(`${tabBase}/account/${account.id}`)}
                  >
                    <IonAvatar slot="start" className="glyph glyph-cash">
                      <CashGlyphIcon />
                    </IonAvatar>
                    <IonLabel className="sub-mono">
                      <h2>{account.name}</h2>
                      <p>
                        {account.balances.length} currenc{account.balances.length === 1 ? "y" : "ies"}
                      </p>
                    </IonLabel>
                    <IonLabel slot="end">
                      <h2>{fmtCcy(accountTotal, displayCurrency)}</h2>
                    </IonLabel>
                    <span slot="end" className="row-chevron" aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
                  </IonItem>
                );
              })}
            </IonList>
          </>
        )}

        {cashAccounts.length > 0 && (
          <>
            <ListDivider label="Cash Accounts" />
            <IonList inset>
              {cashAccounts.map((account) => {
                const accountTotal = account.balances.reduce(
                  (sum, b) => sum + convert(b.balance, b.currency, displayCurrency, fxRates),
                  0,
                );
                return (
                  <IonItem
                    key={account.id}
                    button
                    detail={false}
                    onClick={() => history.push(`${tabBase}/cash-account/${account.id}`)}
                  >
                    <IonAvatar slot="start" className="glyph glyph-cash">
                      <CashGlyphIcon />
                    </IonAvatar>
                    <IonLabel className="sub-mono">
                      <h2>{account.name}</h2>
                      <p>
                        {account.balances.length} currenc{account.balances.length === 1 ? "y" : "ies"}
                      </p>
                    </IonLabel>
                    <IonLabel slot="end">
                      <h2>{fmtCcy(accountTotal, displayCurrency)}</h2>
                    </IonLabel>
                    <span slot="end" className="row-chevron" aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
                  </IonItem>
                );
              })}
            </IonList>
          </>
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

export default CashDetailPage;
