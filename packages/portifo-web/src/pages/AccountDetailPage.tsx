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
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import CurrencyPickerSheet from "../CurrencyPickerSheet";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CashGlyphIcon,
  ChevronDownIcon,
  EmptyState,
  ListDivider,
  MoneyHero,
  StackIcon,
} from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { CURRENCIES } from "../lib/currencies";
import { convert, fmtCcy } from "../lib/fx";

const CAT_COLORS = ["var(--c-1)", "var(--c-2)", "var(--c-3)", "var(--c-4)"];

function currencyName(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.name ?? code;
}

// Investment Account Detail (design-system Screens section): Total Value hero
// (holdings market value + the account's own cash, converted), a stat pair
// breaking that total into Stock Holdings and Cash Holdings, the account's
// stock holdings (bare rows — they open Holding Detail, "the thing itself"),
// and its per-currency cash balances. Cash rows
// are inert (no chevron, not tappable, no divider + button) — that balance is
// a running total built from this account's own Deposit/Withdraw
// transactions, not a value set directly here.
function AccountDetailPage({ match }: RouteComponentProps<{ accountId: string }>) {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const { accounts, loading, openPositionsFor, quotes, fxRates, refreshMarket } = usePortfolioData();
  const account = accounts.find((a) => a.id === match.params.accountId);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);

  const positions = account ? openPositionsFor(account.name) : [];
  const symbolsKey = positions.map((p) => p.symbol).join(",");

  useEffect(() => {
    if (symbolsKey) refreshMarket(symbolsKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

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

  const holdings = positions.map((position, i) => {
    const quote = quotes[position.symbol];
    const costDisplay = position.costByCurrency.reduce(
      (sum, [currency, amount]) => sum + convert(amount, currency, displayCurrency, fxRates),
      0,
    );
    const valueDisplay = quote
      ? convert(quote.price * position.shares, quote.currency, displayCurrency, fxRates)
      : costDisplay;
    const pl = quote ? valueDisplay - costDisplay : null;
    const plPct = pl != null && costDisplay > 1e-9 ? (pl / costDisplay) * 100 : null;
    return {
      symbol: position.symbol,
      name: quote?.shortName,
      valueDisplay,
      pl,
      plPct,
      color: CAT_COLORS[i % CAT_COLORS.length],
    };
  });

  const cashDisplay = account.balances.reduce(
    (sum, b) => sum + convert(b.balance, b.currency, displayCurrency, fxRates),
    0,
  );
  const stockDisplay = holdings.reduce((sum, h) => sum + h.valueDisplay, 0);
  const totalDisplay = stockDisplay + cashDisplay;

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

        <div className="stat-grid">
          <div className="stat-cell">
            <span className="stat-label">Stock Holdings</span>
            <span className="stat-value">{fmtCcy(stockDisplay, displayCurrency)}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">Cash Holdings</span>
            <span className="stat-value">{fmtCcy(cashDisplay, displayCurrency)}</span>
          </div>
        </div>

        <ListDivider label="Holdings" />
        {holdings.length === 0 ? (
          <EmptyState
            icon={<StackIcon />}
            title="No holdings yet"
            body="Buys recorded against this account will show up here."
          />
        ) : (
          <IonList inset>
            {holdings.map((h) => (
              <IonItem key={h.symbol} button detail={false} onClick={() => history.push(`${tabBase}/asset/${h.symbol}`)}>
                <IonAvatar slot="start" className="glyph glyph-stock">
                  <span className="glyph-dot" style={{ background: h.color }} />
                </IonAvatar>
                <IonLabel className="label-sym">
                  <h2>{h.symbol}</h2>
                  {h.name && <p>{h.name}</p>}
                </IonLabel>
                <IonLabel slot="end">
                  <h2>{fmtCcy(h.valueDisplay, displayCurrency)}</h2>
                  {h.pl != null && h.plPct != null && (
                    <p className={h.pl >= 0 ? "positive" : "negative"}>
                      {h.pl >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                      {h.pl >= 0 ? "+" : "−"}
                      {fmtCcy(Math.abs(h.pl), displayCurrency)} · {Math.abs(h.plPct).toFixed(1)}%
                    </p>
                  )}
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}

        <ListDivider label="Cash" />
        {account.balances.length > 0 && (
          <IonList inset>
            {account.balances.map((balance) => (
              <IonItem key={balance.currency} detail={false}>
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

export default AccountDetailPage;
