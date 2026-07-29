import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import { ListDivider, MoneyHero } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { fmtAge, fmtCcy, fmtShares } from "../lib/fx";

// One account's slice of one ticker, plus its open lots — the account and lot
// scopes of Holding Detail, one push deeper. It is the same block as the parent
// page at a smaller magnification: hero, the same four stat cells in the same
// order, the realized line. Deliberately carries NO security-level content (no
// price, no chart link) — those are properties of the stock and live once on
// the parent page. This page is about your shares.
function AccountHoldingPage({ match }: RouteComponentProps<{ symbol: string; account: string }>) {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const symbol = match.params.symbol;
  const account = decodeURIComponent(match.params.account);
  const { tickerAggregates, quotes, refreshMarket } = usePortfolioData();
  const agg = tickerAggregates.find((t) => t.symbol === symbol);
  const pos = agg?.perAccount.find((pa) => pa.account === account);
  const quote = quotes[symbol];

  useEffect(() => {
    if (!quotes[symbol]) refreshMarket([symbol]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  if (!agg || !pos) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref={`${tabBase}/asset/${symbol}`} text={symbol} />
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p>
            No {symbol} position found in {account}.
          </p>
        </IonContent>
      </IonPage>
    );
  }

  const currency = quote?.currency ?? agg.currency;
  const price = quote?.price ?? pos.avgCost;
  const marketValue = price * pos.shares;
  const unrealizedPL = marketValue - pos.costBasis;
  const unrealizedPct = pos.costBasis > 1e-9 ? (unrealizedPL / pos.costBasis) * 100 : 0;
  const gain = unrealizedPL >= 0;
  const todayPL = (quote?.change ?? 0) * pos.shares;
  const todayGain = todayPL >= 0;
  const realizedGain = pos.realizedPL >= 0;
  const realizedPct = pos.realizedCostBasis > 1e-9 ? (pos.realizedPL / pos.realizedCostBasis) * 100 : 0;

  // A percentage past 1000% drops its decimal — the tenth of a percent is noise
  // at that magnitude and the extra glyph breaks the column.
  const pct = (n: number) => (Math.abs(n) >= 1000 ? Math.abs(n).toFixed(0) : Math.abs(n).toFixed(1));

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            {/* The back button carries the ticker and the title carries the
                account, so the bar reads as the breadcrumb NVDA -> Fidelity. */}
            <IonBackButton defaultHref={`${tabBase}/asset/${symbol}`} text={symbol} />
          </IonButtons>
          <IonTitle>{account}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{account}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="detail-hero">
          <div className="detail-name">
            {symbol}
            {quote?.shortName ? ` · ${quote.shortName}` : ""}
          </div>
          <p className="eyebrow">Market value</p>
          <MoneyHero value={marketValue} currency={currency} small />
          <div className="gain-stack">
            {quote && (
              <p className={todayGain ? "positive" : "negative"}>
                <span className="pnl-label">Today:</span>
                {todayGain ? "+" : "−"}
                {fmtCcy(Math.abs(todayPL), currency)} · {todayGain ? "+" : "−"}
                {Math.abs(quote.changePercent).toFixed(2)}%
              </p>
            )}
            <p className={gain ? "positive" : "negative"}>
              <span className="pnl-label">Total:</span>
              {gain ? "+" : "−"}
              {fmtCcy(Math.abs(unrealizedPL), currency)} · {gain ? "+" : "−"}
              {pct(unrealizedPct)}%
            </p>
          </div>
        </div>

        <ListDivider label="Position" meta="this account" />
        <div className="stat-grid">
          <div className="stat-cell">
            <span className="stat-label">Shares</span>
            <span className="stat-value">{fmtShares(pos.shares)}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">Avg Cost / Share</span>
            <span className="stat-value">{fmtCcy(pos.avgCost, currency)}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">Cost Basis</span>
            <span className="stat-value">{fmtCcy(pos.costBasis, currency)}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">Avg Age</span>
            <span className="stat-value">{fmtAge(pos.avgAgeYears)}</span>
          </div>
        </div>

        {pos.realizedCostBasis > 1e-9 && (
          <div className="realized">
            <span className="realized-k">Realized</span>
            <span className={realizedGain ? "realized-v positive" : "realized-v negative"}>
              {realizedGain ? "+" : "−"}
              {fmtCcy(Math.abs(pos.realizedPL), currency)} · {realizedGain ? "+" : "−"}
              {pct(realizedPct)}%
            </span>
            <span className="realized-n">{fmtShares(pos.realizedShares)} sh sold</span>
          </div>
        )}

        {/* Oldest first — age is the reason lots exist on this screen, so it
            drives the sort. Read-only, so no chevron. Today's return per lot is
            the position's return scaled by share count, identical on every row,
            so it is omitted: it distinguishes nothing between lots. */}
        {pos.lots.length > 0 && (
          <>
            <ListDivider label="Open Lots" meta={String(pos.lots.length)} />
            <IonList inset>
              {pos.lots.map((lot, i) => {
                const lotValue = price * lot.shares;
                const lotPL = lotValue - lot.costBasis;
                const lotPct = lot.costBasis > 1e-9 ? (lotPL / lot.costBasis) * 100 : 0;
                const lotGain = lotPL >= 0;
                // "en-US" to match the app's other date formatters rather than
                // drifting with the device locale. Day is 2-digit where the rest
                // of the app uses numeric: these dates form a COLUMN, and rule 10
                // wants a column of dates to line up.
                const dateStr = new Date(`${lot.date}T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                  timeZone: "UTC",
                });
                return (
                  <IonItem key={`${lot.date}-${i}`} detail={false}>
                    <IonLabel>
                      {/* Shares and avg cost is the one learned line for a slice
                          of a position, so it takes the name slot. A lot bought
                          above the current price is underwater, the one thing
                          that separates one lot from another at a glance. */}
                      <h2
                        className={
                          lot.pricePerShare > price
                            ? "row-name lot-figs under"
                            : "row-name lot-figs"
                        }
                      >
                        {fmtShares(lot.shares)} sh · avg {fmtCcy(lot.pricePerShare, currency)}
                      </h2>
                      {/* Age first — it is what this section is sorted on — then
                          the date, so the exact purchase is still on the page. */}
                      <p className="row-sub">
                        {fmtAge(lot.ageYears)} · {dateStr}
                      </p>
                    </IonLabel>
                    <IonLabel slot="end">
                      <h2>{fmtCcy(lotValue, currency)}</h2>
                      <p className={lotGain ? "positive" : "negative"}>
                        {lotGain ? "+" : "−"}
                        {fmtCcy(Math.abs(lotPL), currency)} · {lotGain ? "+" : "−"}
                        {pct(lotPct)}%
                      </p>
                    </IonLabel>
                  </IonItem>
                );
              })}
            </IonList>
          </>
        )}

        {/* Scoped: both actions open Add Transaction with the account AND the
            symbol prefilled, which is the reason to be on this page. */}
        <div className="detail-cta">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => history.push(`${tabBase}/add-transaction`, { type: "buy", symbol, account })}
          >
            Buy in this account
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => history.push(`${tabBase}/add-transaction`, { type: "sell", symbol, account })}
          >
            Sell from this account
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default AccountHoldingPage;
