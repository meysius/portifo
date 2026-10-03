import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import { ExternalLinkIcon, ListDivider, MoneyHero } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { fmtAge, fmtCcy, fmtShares, yahooQuoteUrl } from "../lib/fx";

// The ONE holding screen. There is no AccountHoldingPage any more: it was a
// filter, not a second view — it carried no security-level content and repeated
// this page's block at a smaller magnification, so it added a navigation layer
// and no information. Its cost scaled with account count: a holding in 5
// accounts took 10 navigations to read 7 lots, and no screen could ever show
// two accounts' lots at once.
//
// So the accounts are groups here. The group head IS the account rollup — there
// is no separate accounts table, and nothing is stated twice.

// A percentage past 1000% drops its decimal — the tenth of a percent is noise
// at that magnitude and the extra glyph breaks the column.
const pct = (n: number) => (Math.abs(n) >= 1000 ? Math.abs(n).toFixed(0) : Math.abs(n).toFixed(1));
const sign = (n: number) => (n >= 0 ? "+" : "−");

// "en-US" to match the app's other date formatters rather than drifting with
// the device locale. Day is 2-digit where the rest of the app uses numeric:
// these dates form a COLUMN, and rule 10 wants a column of dates to line up.
const fmtLotDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

// One row shape for every account and every lot: what it is on the left, what it
// is worth on the right, and under them how it got there — shares and cost on
// the left, P&L and return on the right. Two columns, not the old three, so the
// only figures that line up are the ones worth comparing: values with values,
// returns with returns.
function Ret({ pl, pc, currency }: { pl: number; pc: number; currency: string }) {
  return (
    <span className="acct-ret">
      {sign(pl)}
      {fmtCcy(Math.abs(pl), currency)}
      <span className={pl >= 0 ? "acct-pc gain" : "acct-pc loss"}>
        {sign(pl)}
        {pct(pc)}%
      </span>
    </span>
  );
}

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

  // A closed position inverts the page: realized P&L takes the hero, the
  // open-position stats go, and the accounts carry realized figures with no
  // lots behind them. The market block stays — it is about the security.
  const realizedAccounts = agg.perAccount.filter((pa) => pa.realizedCostBasis > 1e-9);
  // Groups sort by market value desc — largest first is the useful default for
  // a rollup. Lots sort oldest first within a group, which is the sort the lot
  // section always used.
  const openAccounts = agg.perAccount
    .filter((pa) => pa.shares > 0)
    .map((pa) => ({ ...pa, value: price * pa.shares, lots: [...pa.lots].sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => b.value - a.value);
  const lotCount = openAccounts.reduce((n, pa) => n + pa.lots.length, 0);

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
            {/* DS .closed-tag on the .ph-large row — the same chip the Holdings
                row carries, so the push lands on a page that says the same
                thing. It scrolls away with the title. */}
            {agg.closed && (
              <span slot="end" className="type-tag">
                Closed
              </span>
            )}
          </IonToolbar>
        </IonHeader>

        <div className="detail-hero">
          {/* The ticker is the page title; the company name is its subtitle
              (guidelines state 3a — never repeat the title here). */}
          {quote?.shortName && <div className="detail-name">{quote.shortName}</div>}
          {agg.closed ? (
            <>
              <p className="detail-cap">
                Realized {realizedGain ? "gain" : "loss"} in {currency}
              </p>
              <div className={realizedGain ? "hero-realized positive" : "hero-realized negative"}>
                <MoneyHero value={agg.realizedPL} currency={currency} small />
              </div>
              <div className="gain-stack ranked">
                <p className={realizedGain ? "positive" : "negative"}>
                  <span className="pnl-label">Return</span>
                  <span className="pc">
                    {sign(agg.realizedPL)}
                    {pct(realizedPct)}%
                  </span>
                  <span>on {fmtCcy(agg.realizedCostBasis, currency)}</span>
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Market value, not price — this is a portfolio tracker, and it is
                  the same figure the Holdings row shows, so the push reads as a
                  zoom. Price/share heads the facts list below. The caption names the
                  currency, so no section head has to. */}
              <p className="detail-cap">Market value in {currency}</p>
              <MoneyHero value={marketValue} currency={currency} small />
              {/* Total above Today: the hero figure is market value and the
                  total return is how it got there, so they are one thought.
                  Only the percentage is tinted — see .gain-stack.ranked. */}
              <div className="gain-stack ranked">
                <p className={gain ? "positive" : "negative"}>
                  <span className="pnl-label">Total</span>
                  {sign(unrealizedPL)}
                  {fmtCcy(Math.abs(unrealizedPL), currency)}
                  <span className="pc">
                    {sign(unrealizedPL)}
                    {pct(unrealizedPct)}%
                  </span>
                </p>
                {quote && (
                  <p className={todayGain ? "positive sub" : "negative sub"}>
                    <span className="pnl-label">Today</span>
                    {sign(todayPL)}
                    {fmtCcy(Math.abs(todayPL), currency)}
                    <span className="pc">
                      {sign(todayPL)}
                      {Math.abs(quote.changePercent).toFixed(2)}%
                    </span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ONE facts list for the security and the position. It used to be two
            boxed stat grids under two section heads (Market / Position) — three
            container styles on one screen for six figures. Now every figure is
            a hairline row, label left, value right, so the values form a single
            column like the account groups below. The price comes first: it is
            about the security, and on a closed position it is what "Buy again"
            is weighed against. */}
        <div className="facts">
          <div className="fact">
            <span className="fact-k">Price per share</span>
            {/* A closed position has no stake in the price, so with no quote the
                row is a dash: the avg-cost fallback the open screen uses would
                pass a historical figure off as a live one. */}
            <span className="fact-v">{agg.closed && !quote ? "—" : fmtCcy(price, currency)}</span>
          </div>
          <div className="fact">
            <span className="fact-k">{agg.closed ? "Shares sold" : "Shares"}</span>
            <span className="fact-v">{fmtShares(agg.closed ? agg.realizedShares : agg.totalShares)}</span>
          </div>
          <div className="fact">
            <span className="fact-k">Avg cost per share</span>
            <span className="fact-v">
              {fmtCcy(
                agg.closed && agg.realizedShares > 1e-9 ? agg.realizedCostBasis / agg.realizedShares : agg.avgCost,
                currency,
              )}
            </span>
          </div>
          <div className="fact">
            <span className="fact-k">Cost basis</span>
            <span className="fact-v">{fmtCcy(agg.closed ? agg.realizedCostBasis : agg.costBasis, currency)}</span>
          </div>
          <div className="fact">
            {/* A closed position has no open shares to age, so the row becomes
                how long the sold shares were actually held. */}
            <span className="fact-k">{agg.closed ? "Avg hold" : "Avg age"}</span>
            <span className="fact-v">{fmtAge(agg.closed ? agg.realizedAgeYears : agg.avgAgeYears)}</span>
          </div>
          {!agg.closed && agg.realizedCostBasis > 1e-9 && (
            <div className="fact">
              <span className="fact-k">
                Realized
                <span className="fact-sub">{fmtShares(agg.realizedShares)} sh sold</span>
              </span>
              <span className={realizedGain ? "fact-v rz" : "fact-v rz loss"}>
                {sign(agg.realizedPL)}
                {fmtCcy(Math.abs(agg.realizedPL), currency)}{" "}
                <span className="pc">
                  {sign(agg.realizedPL)}
                  {pct(realizedPct)}%
                </span>
              </span>
            </div>
          )}
          {/* Leaves the app, so an outward arrow — never a chevron. The whole
              row is the anchor. Portifo does not compete with a charting
              product: it hands the chart to Yahoo Finance, which is also where
              the app's own prices come from. */}
          <a className="fact" href={yahooQuoteUrl(symbol)} target="_blank" rel="noopener noreferrer">
            <span className="fact-k">Chart</span>
            <span className="fact-link">
              Yahoo Finance
              <ExternalLinkIcon />
            </span>
          </a>
        </div>

        {/* ACCOUNTS. Each account is one row in the same shape as the facts
            above it, hairline-ruled, no rail and no three-column grid. Its
            third line states how many lots it holds, and they are listed
            indented beneath it — always shown, so every lot on the screen is
            readable without a tap. A one-lot account takes the same shape: its
            lot row restates the account's figures, and that is the right trade,
            because every account reads the same way down the column. */}
        {!agg.closed && openAccounts.length > 0 && (
          <>
            <ListDivider
              label="Accounts"
              meta={`${openAccounts.length} ${openAccounts.length === 1 ? "account" : "accounts"} · ${lotCount} ${lotCount === 1 ? "lot" : "lots"}`}
            />
            <div className="accts">
              {openAccounts.map((pa) => {
                const paPL = pa.value - pa.costBasis;
                const paPct = pa.costBasis > 1e-9 ? (paPL / pa.costBasis) * 100 : 0;
                return (
                  <div className="acct-group" key={pa.account}>
                    <div className="acct">
                      <span className="acct-line">
                        <span className="acct-title">{pa.account}</span>
                        <span className="acct-value">{fmtCcy(pa.value, currency)}</span>
                      </span>
                      <span className="acct-line acct-sub">
                        <span>
                          {fmtShares(pa.shares)} sh · avg {fmtCcy(pa.avgCost, currency)}
                        </span>
                        <Ret pl={paPL} pc={paPct} currency={currency} />
                      </span>
                      <span className="acct-note">
                        {pa.lots.length} {pa.lots.length === 1 ? "lot" : "lots"}
                      </span>
                    </div>
                    <div className="lots">
                      {pa.lots.map((lot, i) => {
                        const lotValue = price * lot.shares;
                        const lotPL = lotValue - lot.costBasis;
                        const lotPct = lot.costBasis > 1e-9 ? (lotPL / lot.costBasis) * 100 : 0;
                        return (
                          // A lot is a purchase, so it is named by its date.
                          <div className="lot" key={`${lot.date}-${i}`}>
                            <span className="acct-line">
                              <span className="lot-date">{fmtLotDate(lot.date)}</span>
                              <span className="lot-value">{fmtCcy(lotValue, currency)}</span>
                            </span>
                            <span className="acct-line acct-sub">
                              <span>
                                {fmtShares(lot.shares)} sh at {fmtCcy(lot.pricePerShare, currency)} ·{" "}
                                {fmtAge(lot.ageYears)}
                              </span>
                              <Ret pl={lotPL} pc={lotPct} currency={currency} />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* A closed position has no lots behind an account, so the row is the
            whole account and it carries realized figures. */}
        {agg.closed && realizedAccounts.length > 0 && (
          <>
            <ListDivider
              label="Accounts"
              meta={`${realizedAccounts.length} ${realizedAccounts.length === 1 ? "account" : "accounts"}`}
            />
            <div className="accts">
              {realizedAccounts.map((pa) => {
                const paRealPct = pa.realizedCostBasis > 1e-9 ? (pa.realizedPL / pa.realizedCostBasis) * 100 : 0;
                return (
                  <div className="acct-group" key={pa.account}>
                    <div className="acct">
                      <span className="acct-line">
                        <span className="acct-title">{pa.account}</span>
                        <span className="acct-value">
                          {sign(pa.realizedPL)}
                          {fmtCcy(Math.abs(pa.realizedPL), currency)}
                        </span>
                      </span>
                      <span className="acct-line acct-sub">
                        <span>{fmtShares(pa.realizedShares)} sh sold</span>
                        <span className={pa.realizedPL >= 0 ? "acct-pc gain" : "acct-pc loss"}>
                          {sign(pa.realizedPL)}
                          {pct(paRealPct)}%
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* The title is the ticker, so the labels do not need to restate the
            scope — side by side they cost 48pt instead of 105pt. */}
        <div className={agg.closed ? "detail-cta" : "detail-cta row"}>
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
