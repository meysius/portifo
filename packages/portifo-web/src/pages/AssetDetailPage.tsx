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
  // block and the open-position stats go, and the accounts carry realized
  // figures with no lots behind them.
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
                  zoom. Price/share lives in the Market block below. */}
              <p className="eyebrow">Market value</p>
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

        {/* The security, not the position. Portifo does not compete with a
            charting product: it carries the live price and hands the chart to
            Yahoo Finance, which is also where the app's own prices come from,
            so the stored symbol is guaranteed to resolve there. */}
        {!agg.closed && (
          <>
            <ListDivider label="Market" meta={currency} />
            <div className="stat-grid">
              <div className="stat-cell">
                <span className="stat-label">Price / Share</span>
                <span className="stat-value">{fmtCcy(price, currency)}</span>
              </div>
              {/* Leaves the app, so an outward arrow — never a chevron. The whole
                  cell is the anchor. */}
              <a
                className="stat-cell"
                href={yahooQuoteUrl(symbol)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="stat-label">Chart</span>
                <span className="stat-link">
                  Yahoo Finance
                  <ExternalLinkIcon />
                </span>
              </a>
            </div>
          </>
        )}

        {/* The cost side. The hero says what it is worth; this says what it cost.
            Realized is the grid's full-width footer cell — outside it, it was the
            only block on the screen with neither a divider nor a box. */}
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
          {!agg.closed && agg.realizedCostBasis > 1e-9 && (
            <div className="stat-cell wide">
              <span className="stat-label">Realized</span>
              <span className={realizedGain ? "rz" : "rz loss"}>
                {sign(agg.realizedPL)}
                {fmtCcy(Math.abs(agg.realizedPL), currency)}{" "}
                <span className="pc">
                  {sign(agg.realizedPL)}
                  {pct(realizedPct)}%
                </span>
              </span>
              <span className="rz-n">{fmtShares(agg.realizedShares)} sh sold</span>
            </div>
          )}
        </div>

        {/* ACCOUNTS AS GROUPS. The head is the rollup and its lots hang beneath
            it, sharing one column grid so an account's total sits directly above
            the lot values that sum to it. Nothing pushes any more, so no
            chevrons (rule 09). */}
        {!agg.closed && openAccounts.length > 0 && (
          <>
            <ListDivider
              label="Accounts"
              meta={`${openAccounts.length} · ${lotCount} ${lotCount === 1 ? "lot" : "lots"}`}
            />
            {openAccounts.map((pa) => {
              const paPL = pa.value - pa.costBasis;
              const paPct = pa.costBasis > 1e-9 ? (paPL / pa.costBasis) * 100 : 0;
              return (
                <div className="agrp" key={pa.account}>
                  <div className="ah">
                    <span className="ah-n">{pa.account}</span>
                    <span className="ah-v">{fmtCcy(pa.value, currency)}</span>
                    <span className={paPL >= 0 ? "ah-p gain" : "ah-p loss"}>
                      {sign(paPL)}
                      {pct(paPct)}%
                    </span>
                    {/* The lot count is STATED, never inferred by counting rows.
                        Every head reads the same way — shares, lots, avg cost —
                        so the meta slot means one thing all the way down the
                        column. An earlier pass collapsed a one-lot account into
                        its head and swapped this line for the lot's receipt;
                        that made the slot mean two different things depending on
                        the group, and left the lot count of the collapsed ones
                        undiscoverable. */}
                    <span className="ah-m">
                      <span>
                        {fmtShares(pa.shares)} sh · {pa.lots.length}{" "}
                        {pa.lots.length === 1 ? "lot" : "lots"} · avg {fmtCcy(pa.avgCost, currency)}
                      </span>
                      <span>
                        {sign(paPL)}
                        {fmtCcy(Math.abs(paPL), currency)}
                      </span>
                    </span>
                  </div>
                  {/* Always rendered, at any lot count. A one-lot account repeats
                      its head's value and return, and that is the right trade:
                      a subtotal equal to its single member is how every grouped
                      table behaves, and the lot row still adds the purchase date
                      and age that the head does not carry. */}
                  <div className="glots">
                    {pa.lots.map((lot, i) => {
                        const lotValue = price * lot.shares;
                        const lotPL = lotValue - lot.costBasis;
                        const lotPct = lot.costBasis > 1e-9 ? (lotPL / lot.costBasis) * 100 : 0;
                        return (
                          <div className="glot" key={`${lot.date}-${i}`}>
                            <span className="glot-px">
                              <b>{fmtShares(lot.shares)}</b> at {fmtCcy(lot.pricePerShare, currency)}
                            </span>
                            <span className="glot-v">{fmtCcy(lotValue, currency)}</span>
                            <span className={lotPL >= 0 ? "glot-p gain" : "glot-p loss"}>
                              {sign(lotPL)}
                              {pct(lotPct)}%
                            </span>
                            <span className="glot-m">
                              <span>
                                {fmtLotDate(lot.date)} · {fmtAge(lot.ageYears)}
                              </span>
                              <span>
                                {sign(lotPL)}
                                {fmtCcy(Math.abs(lotPL), currency)}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* A closed position has no lots behind an account, so the group head is
            the whole row and it carries realized figures. */}
        {agg.closed && realizedAccounts.length > 0 && (
          <>
            <ListDivider label="Accounts" meta={String(realizedAccounts.length)} />
            {realizedAccounts.map((pa) => {
              const paRealPct = pa.realizedCostBasis > 1e-9 ? (pa.realizedPL / pa.realizedCostBasis) * 100 : 0;
              return (
                <div className="agrp" key={pa.account}>
                  <div className="ah">
                    <span className="ah-n">{pa.account}</span>
                    <span className="ah-v">
                      {sign(pa.realizedPL)}
                      {fmtCcy(Math.abs(pa.realizedPL), currency)}
                    </span>
                    <span className={pa.realizedPL >= 0 ? "ah-p gain" : "ah-p loss"}>
                      {sign(pa.realizedPL)}
                      {pct(paRealPct)}%
                    </span>
                    <span className="ah-m">
                      <span>{fmtShares(pa.realizedShares)} sh sold</span>
                    </span>
                  </div>
                </div>
              );
            })}
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
