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
import { ChevronRightIcon, ExternalLinkIcon, ListDivider, MoneyHero } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { fmtAge, fmtCcy, fmtShares, yahooQuoteUrl } from "../lib/fx";

function AssetDetailPage({ match }: RouteComponentProps<{ symbol: string }>) {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const symbol = match.params.symbol;
  const { tickerAggregates, quotes, refreshMarket } = usePortfolioData();
  const agg = tickerAggregates.find((t) => t.symbol === symbol);
  const quote = quotes[symbol];

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
  const unrealizedPct = agg.costBasis > 1e-9 ? (unrealizedPL / agg.costBasis) * 100 : 0;
  const gain = unrealizedPL >= 0;
  const todayPL = (quote?.change ?? 0) * agg.totalShares;
  const todayGain = todayPL >= 0;

  const realizedGain = agg.realizedPL >= 0;
  const realizedPct = agg.realizedCostBasis > 1e-9 ? (agg.realizedPL / agg.realizedCostBasis) * 100 : 0;

  // A closed position inverts the page: realized P&L takes the hero, the market
  // block and the open-position stats go, and the accounts stop being a
  // disclosure control because there are no lots behind them (rule 09).
  const openAccounts = agg.perAccount.filter((pa) => pa.shares > 0);
  const realizedAccounts = agg.perAccount.filter((pa) => pa.realizedCostBasis > 1e-9);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={tabBase} text={tabLabel} />
          </IonButtons>
          <IonTitle>{symbol}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{symbol}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="detail-hero">
          {/* The ticker is the page title; the company name is its subtitle
              (guidelines state 3a — never repeat the title here). */}
          {quote?.shortName && <div className="detail-name">{quote.shortName}</div>}
          {agg.closed ? (
            <>
              <p className="eyebrow">Realized {realizedGain ? "gain" : "loss"}</p>
              <div className={realizedGain ? "hero-realized positive" : "hero-realized negative"}>
                <MoneyHero value={agg.realizedPL} currency={currency} small />
              </div>
              <div className="gain-stack">
                <p className={realizedGain ? "positive" : "negative"}>
                  <span className="pnl-label">Return:</span>
                  {realizedGain ? "+" : "−"}
                  {Math.abs(realizedPct).toFixed(1)}% on {fmtCcy(agg.realizedCostBasis, currency)}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Market value, not price — this is a portfolio tracker, and it is
                  the same figure the Holdings row shows, so the push reads as a
                  zoom. Price/share lives in the Market block below. */}
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
                  {Math.abs(unrealizedPct).toFixed(1)}%
                </p>
              </div>
            </>
          )}
        </div>

        {/* The security, not the position. Portifo does not compete with a
            charting product: it carries the live price and hands the chart to
            Yahoo Finance, which is also where the app's own prices come from,
            so the stored symbol is guaranteed to resolve there. */}
        {!agg.closed && (
          <>
            <ListDivider label="Market" meta={currency} />
            <IonList inset className="fieldcard-list">
              <IonItem>
                <IonLabel>Price / Share</IonLabel>
                <IonLabel slot="end">{fmtCcy(price, currency)}</IonLabel>
              </IonItem>
              <IonItem
                button
                detail={false}
                href={yahooQuoteUrl(symbol)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IonLabel>Chart</IonLabel>
                <IonLabel slot="end">
                  {/* Leaves the app, so an outward arrow — never a chevron. */}
                  <span className="field-link">
                    Yahoo Finance
                    <ExternalLinkIcon />
                  </span>
                </IonLabel>
              </IonItem>
            </IonList>
          </>
        )}

        {/* The cost side. The hero says what it is worth; this says what it cost. */}
        <ListDivider label="Position" meta="all accounts" />
        <div className="stat-grid">
          <div className="stat-cell">
            <span className="stat-label">{agg.closed ? "Shares sold" : "Shares"}</span>
            <span className="stat-value">
              {fmtShares(agg.closed ? agg.realizedShares : agg.totalShares)}
            </span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">Avg Cost / Share</span>
            <span className="stat-value">
              {fmtCcy(
                agg.closed && agg.realizedShares > 1e-9 ? agg.realizedCostBasis / agg.realizedShares : agg.avgCost,
                currency,
              )}
            </span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">Cost Basis</span>
            <span className="stat-value">{fmtCcy(agg.closed ? agg.realizedCostBasis : agg.costBasis, currency)}</span>
          </div>
          <div className="stat-cell">
            {/* A closed position has no open shares to age, so the cell becomes
                how long the sold shares were actually held. */}
            <span className="stat-label">{agg.closed ? "Avg Hold" : "Avg Age"}</span>
            <span className="stat-value">{fmtAge(agg.closed ? agg.realizedAgeYears : agg.avgAgeYears)}</span>
          </div>
        </div>

        {/* Closed money, so it sits outside the grid rather than becoming a
            fifth cell that reads like part of the open position. */}
        {!agg.closed && agg.realizedCostBasis > 1e-9 && (
          <div className="realized">
            <span className="realized-k">Realized</span>
            <span className={realizedGain ? "realized-v positive" : "realized-v negative"}>
              {realizedGain ? "+" : "−"}
              {fmtCcy(Math.abs(agg.realizedPL), currency)} · {realizedGain ? "+" : "−"}
              {Math.abs(realizedPct).toFixed(1)}%
            </span>
            <span className="realized-n">{fmtShares(agg.realizedShares)} sh sold</span>
          </div>
        )}

        {/* Account rows push Account Holding, so they carry a chevron (rule 09).
            A closed position has nothing to push to, so it shows realized return
            per account and no chevron. */}
        {(agg.closed ? realizedAccounts : openAccounts).length > 0 && (
          <>
            <ListDivider label="Accounts" meta={String((agg.closed ? realizedAccounts : openAccounts).length)} />
            <IonList inset>
              {(agg.closed ? realizedAccounts : openAccounts).map((pa) => {
                const paValue = price * pa.shares;
                const paPL = paValue - pa.costBasis;
                const paPct = pa.costBasis > 1e-9 ? (paPL / pa.costBasis) * 100 : 0;
                const paGain = paPL >= 0;
                const paRealGain = pa.realizedPL >= 0;
                const paRealPct = pa.realizedCostBasis > 1e-9 ? (pa.realizedPL / pa.realizedCostBasis) * 100 : 0;
                return (
                  <IonItem
                    key={pa.account}
                    button={!agg.closed}
                    detail={false}
                    onClick={
                      agg.closed
                        ? undefined
                        : () => history.push(`${tabBase}/asset/${symbol}/account/${encodeURIComponent(pa.account)}`)
                    }
                  >
                    <IonLabel>
                      <h2 className="row-name">{pa.account}</h2>
                      <p className="row-sub">
                        {agg.closed
                          ? `${fmtShares(pa.realizedShares)} sh sold`
                          : `${fmtShares(pa.shares)} sh · avg ${fmtCcy(pa.avgCost, currency)}`}
                      </p>
                    </IonLabel>
                    <IonLabel slot="end">
                      {agg.closed ? (
                        <h2 className={paRealGain ? "positive" : "negative"}>
                          {paRealGain ? "+" : "−"}
                          {fmtCcy(Math.abs(pa.realizedPL), currency)} · {paRealGain ? "+" : "−"}
                          {Math.abs(paRealPct).toFixed(1)}%
                        </h2>
                      ) : (
                        <>
                          <h2>{fmtCcy(paValue, currency)}</h2>
                          <p className={paGain ? "positive" : "negative"}>
                            {paGain ? "+" : "−"}
                            {fmtCcy(Math.abs(paPL), currency)} · {paGain ? "+" : "−"}
                            {Math.abs(paPct).toFixed(1)}%
                          </p>
                        </>
                      )}
                    </IonLabel>
                    {!agg.closed && (
                      <span slot="end" className="row-chevron" aria-hidden="true">
                        <ChevronRightIcon />
                      </span>
                    )}
                  </IonItem>
                );
              })}
            </IonList>
          </>
        )}

        <div className="detail-cta">
          <button
            type="button"
            className={agg.closed ? "btn btn-secondary" : "btn btn-primary"}
            onClick={() => history.push(`${tabBase}/add-transaction`, { type: "buy", symbol })}
          >
            {agg.closed ? `Buy ${symbol} again` : `Buy ${symbol}`}
          </button>
          {!agg.closed && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => history.push(`${tabBase}/add-transaction`, { type: "sell", symbol })}
            >
              Sell {symbol}
            </button>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

export default AssetDetailPage;
