import {
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
import PriceChart, { RangePicker } from "../PriceChart";
import { ListDivider, MoneyHero } from "../components/ds";
import { getHistory } from "../api/market";
import type { HistoryPoint, HistoryRange } from "../api/market";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { fmtCcy, fmtShares } from "../lib/fx";

// DS example reads "8 months" for a sub-year position; matches the average-cost
// weighted purchase age computed in aggregateTickers.
function fmtAge(years: number): string {
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  return `${years.toFixed(1)} years`;
}

function AssetDetailPage({ match }: RouteComponentProps<{ symbol: string }>) {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const symbol = match.params.symbol;
  const { tickerAggregates, quotes, refreshMarket } = usePortfolioData();
  const agg = tickerAggregates.find((t) => t.symbol === symbol);
  const quote = quotes[symbol];

  const [range, setRange] = useState<HistoryRange>("1M");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    getHistory(symbol, range)
      .then((p) => {
        if (!cancelled) setPoints(p);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  useEffect(() => {
    if (!quotes[symbol]) refreshMarket([symbol]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  if (!agg) {
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
          <p>No position found for {symbol}.</p>
        </IonContent>
      </IonPage>
    );
  }

  const currency = quote?.currency ?? agg.currency;
  const price = quote?.price ?? agg.avgCost;
  const marketValue = price * agg.totalShares;
  const unrealizedPL = marketValue - agg.costBasis;
  const unrealizedPLPct = agg.costBasis > 1e-9 ? (unrealizedPL / agg.costBasis) * 100 : 0;
  const gain = unrealizedPL >= 0;
  const todayPL = (quote?.change ?? 0) * agg.totalShares;
  const todayGain = todayPL >= 0;

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
            <span className="detail-sym">{symbol}</span>
            {quote?.shortName && <span className="detail-name">{quote.shortName}</span>}
          </div>
          <IonNote className="eyebrow">{agg.closed ? "Price / Share" : "Total Holding Value"}</IonNote>
          <MoneyHero value={agg.closed ? price : marketValue} currency={currency} small />
          {!agg.closed && (
            <>
              {/* Same shape as the Holdings list row: shares @ avg cost → live
                  price, then Today/Total stacked beneath — DS .row-meta +
                  .pnl-label, reused here instead of the old price-only hero. */}
              <p className="row-meta detail-rowmeta">
                {fmtShares(agg.totalShares)} @ {fmtCcy(agg.avgCost, currency)} → {fmtCcy(price, currency)}
              </p>
              <div className="gain-stack">
                {quote && (
                  <p className={todayGain ? "positive" : "negative"}>
                    <span className="pnl-label">Today:</span>
                    {todayGain ? "+" : "−"}
                    {fmtCcy(Math.abs(todayPL), currency)} · {Math.abs(quote.changePercent).toFixed(1)}%
                  </p>
                )}
                <p className={gain ? "positive" : "negative"}>
                  <span className="pnl-label">Total:</span>
                  {gain ? "+" : "−"}
                  {fmtCcy(Math.abs(unrealizedPL), currency)} · {Math.abs(unrealizedPLPct).toFixed(1)}%
                </p>
              </div>
            </>
          )}
        </div>

        <div className="chart-card">
          {chartLoading ? (
            <div className="chart-loading">
              <IonSpinner name="crescent" />
            </div>
          ) : points.length > 1 ? (
            <PriceChart points={points} currency={currency} />
          ) : (
            <div className="chart-loading">
              <IonNote>Not enough data for this range</IonNote>
            </div>
          )}
          <RangePicker range={range} onChange={setRange} />
        </div>

        {(!agg.closed || agg.realizedCostBasis > 0) && (
          <div className="stat-grid">
            {!agg.closed && (
              <>
                <div className="stat-cell">
                  <span className="stat-label">Shares</span>
                  <span className="stat-value">{fmtShares(agg.totalShares)}</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Avg Cost / Share</span>
                  <span className="stat-value">{fmtCcy(agg.avgCost, currency)}</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Avg Age</span>
                  <span className="stat-value">{fmtAge(agg.avgAgeYears)}</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Cost Basis</span>
                  <span className="stat-value">{fmtCcy(agg.costBasis, currency)}</span>
                </div>
              </>
            )}
            {agg.realizedCostBasis > 0 && (
              <>
                <div className="stat-cell">
                  <span className="stat-label">Realized P&amp;L</span>
                  <span className={`stat-value ${agg.realizedPL >= 0 ? "positive" : "negative"}`}>
                    {agg.realizedPL >= 0 ? "+" : "−"}
                    {fmtCcy(Math.abs(agg.realizedPL), currency)}
                  </span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Realized Return</span>
                  <span className={`stat-value ${agg.realizedPL >= 0 ? "positive" : "negative"}`}>
                    {agg.realizedPL >= 0 ? "+" : "−"}
                    {Math.abs((agg.realizedPL / agg.realizedCostBasis) * 100).toFixed(1)}%
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {agg.perAccount.length > 0 && (
          <>
            <ListDivider label="By Account" />
            <IonList inset>
              {agg.perAccount.map((pa) => (
                <IonItem key={pa.account}>
                  <IonLabel className="sub-mono">
                    <h2>{pa.account}</h2>
                    <p>Investment Account</p>
                  </IonLabel>
                  <IonLabel slot="end">
                    {/* Total cost this account has in the position (shares × avg
                        cost), with the share count / avg cost as the supporting
                        meta line. */}
                    <h2>{fmtCcy(pa.shares * pa.avgCost, currency)}</h2>
                    <p>{fmtShares(pa.shares)} sh · avg {fmtCcy(pa.avgCost, currency)}</p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          </>
        )}

        <div className="detail-cta">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => history.push(`${tabBase}/add-transaction`, { type: "buy", symbol })}
          >
            Buy {symbol}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => history.push(`${tabBase}/add-transaction`, { type: "sell", symbol })}
          >
            Sell {symbol}
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default AssetDetailPage;
