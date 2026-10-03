import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import type { Quote } from "../api/market";
import HoldingChart from "../components/HoldingChart";
import type { TradeMark } from "../components/HoldingChart";
import { ChevronRightIcon, ExternalLinkIcon } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useDisplayCurrency } from "../lib/displayCurrency";
import {
  convert,
  fmtAge,
  fmtCcy,
  fmtDay,
  fmtShares,
  fmtSignedCcy,
  fmtSignedPct,
  parseDay,
  yahooQuoteUrl,
} from "../lib/fx";
import { cashValue, positionsValue } from "../lib/positions";
import type { AccountPosition, Lot, TickerAgg } from "../lib/positions";

// The ONE holding screen, read top to bottom as three questions:
//   1. What is it worth, and am I up?  — the hero: market value, then all-time
//      and today, answered before any scroll.
//   2. Where is the price, and where did I buy? — the chart: share price with
//      buy/sell dots and an avg-cost line.
//   3. How is it made up? — position facts, then where it is held (accounts →
//      the lots still open in them), then what has already been realized.
// Each layer goes further back in time.
//
// Colour budget: the hero deltas are tinted at full strength. Everywhere below,
// only a PERCENTAGE is tinted and the money beside it stays neutral — with every
// figure tinted, green stops meaning gain and becomes the page's colour.
//
// No price means no value, no gain and no today. Cost figures still show, and
// say they are cost — the old avg-cost fallback passed a historical figure off
// as a live one.

const tone = (n: number) => (n > 1e-9 ? "gain" : n < -1e-9 ? "loss" : "");

// Shrinks a one-line figure until it fits its column (38px down to 22px), so a
// seven-figure value never wraps or clips.
function FitFigure({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = 38;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > 22) el.style.fontSize = `${--size}px`;
  });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function Sk({ w, h = 14, style }: { w: string; h?: number; style?: CSSProperties }) {
  return <div className="hd-sk" style={{ width: w, height: h, ...style }} />;
}

function Cell({ k, v, text, wide }: { k: string; v: ReactNode; text?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "hd-cell wide" : "hd-cell"}>
      <div className="k">{k}</div>
      <div className={text ? "t" : "v num"}>{v}</div>
    </div>
  );
}

// A lot is a purchase, so it is named by its date. A sale shrinks every open lot
// in its account pro rata (average cost), so a lot can hold fewer shares than
// were bought — "6.67 of 10 sh" says so; its price never changes.
function LotRow({ lot, price, ccy }: { lot: Lot; price: number | null; ccy: string }) {
  const shrunk = Math.abs(lot.shares - lot.origShares) > 1e-6;
  const sh = shrunk ? `${fmtShares(lot.shares)} of ${fmtShares(lot.origShares)} sh` : `${fmtShares(lot.shares)} sh`;
  return (
    <div className="hd-row">
      <div className="l">
        <div className="hd-lotdate">{fmtDay(parseDay(lot.date))}</div>
        <div className="hd-meta">
          {sh} @ {fmtCcy(lot.pricePerShare, ccy)} · {fmtAge(lot.ageYears)}
        </div>
      </div>
      <div className="r">
        <Worth value={price != null ? lot.shares * price : null} cost={lot.costBasis} ccy={ccy} />
      </div>
    </div>
  );
}

// The right-hand column of an account or lot row: value over P&L, or — with no
// price — cost, labelled as cost.
function Worth({ value, cost, ccy }: { value: number | null; cost: number; ccy: string }) {
  if (value == null) {
    return (
      <>
        <div className="v num">{fmtCcy(cost, ccy)}</div>
        <div className="g">cost</div>
      </>
    );
  }
  const g = value - cost;
  return (
    <>
      <div className="v num">{fmtCcy(value, ccy)}</div>
      <div className="g">
        <span className="num">{fmtSignedCcy(g, ccy)}</span>
        <span className={`num ${tone(g)}`}>{fmtSignedPct(cost > 1e-9 ? (g / cost) * 100 : 0)}</span>
      </div>
    </>
  );
}

const ShrinkNote = ({ lots }: { lots: Lot[] }) =>
  lots.some((l) => Math.abs(l.shares - l.origShares) > 1e-6) ? (
    <div className="hd-foot">
      Each lot is what remains of one purchase. A sale shrinks every lot in that account proportionally (average
      cost), so a lot can hold fewer shares than were bought. Its price never changes.
    </div>
  ) : null;

function Hero({
  agg,
  quote,
  loading,
  ccy,
  displayCurrency,
  fx,
  lastSell,
  onRetry,
}: {
  agg: TickerAgg;
  quote: Quote | undefined;
  loading: boolean;
  ccy: string;
  displayCurrency: string;
  fx: (n: number) => number;
  lastSell: string | null;
  onRetry: () => void;
}) {
  if (agg.closed) {
    const ret = agg.realizedCostBasis > 1e-9 ? (agg.realizedPL / agg.realizedCostBasis) * 100 : 0;
    return (
      <section className="hd-hero">
        <div className="hd-lbl">Realized {agg.realizedPL < 0 ? "loss" : "gain"}</div>
        <FitFigure className={`hd-big num ${tone(agg.realizedPL)}`}>{fmtSignedCcy(agg.realizedPL, ccy)}</FitFigure>
        <div className="hd-deltas two">
          <span className={`num ${tone(ret)}`}>{fmtSignedPct(ret)}</span>
          <span className="dl">on {fmtCcy(agg.realizedCostBasis, ccy)} cost</span>
        </div>
        {lastSell && <div className="hd-pill">Position closed · last sold {fmtDay(parseDay(lastSell))}</div>}
      </section>
    );
  }
  if (!quote && loading) {
    return (
      <section className="hd-hero">
        <div className="hd-lbl">Market value</div>
        <Sk w="62%" h={38} style={{ marginTop: 6 }} />
        <Sk w="48%" h={16} style={{ marginTop: 12 }} />
        <Sk w="40%" h={16} style={{ marginTop: 7 }} />
      </section>
    );
  }
  if (!quote) {
    return (
      <section className="hd-hero">
        <div className="hd-lbl">Market value</div>
        <div className="hd-unavail">
          <span>
            <b>Price unavailable</b>
            Value and gain need a live quote.
          </span>
          <button type="button" className="hd-retry" onClick={onRetry}>
            Retry
          </button>
        </div>
      </section>
    );
  }
  const mv = quote.price * agg.totalShares;
  const unreal = mv - agg.costBasis;
  const unrealPct = agg.costBasis > 1e-9 ? (unreal / agg.costBasis) * 100 : 0;
  const today = quote.change * agg.totalShares;
  return (
    <section className="hd-hero">
      <div className="hd-lbl">Market value</div>
      <FitFigure className="hd-big num">{fmtCcy(mv, ccy)}</FitFigure>
      {ccy !== displayCurrency && (
        <div className="hd-fx">
          ≈ <span className="num">{fmtCcy(fx(mv), displayCurrency)}</span> {displayCurrency}
        </div>
      )}
      <div className="hd-deltas">
        <span className={`num ${tone(unreal)}`}>{fmtSignedCcy(unreal, ccy)}</span>
        <span className={`num ${tone(unreal)}`}>{fmtSignedPct(unrealPct)}</span>
        <span className="dl">{agg.realizedShares > 1e-9 ? "unrealized" : "all time"}</span>
        <span className={`num ${tone(today)}`}>{fmtSignedCcy(today, ccy)}</span>
        <span className={`num ${tone(today)}`}>{fmtSignedPct(quote.changePercent)}</span>
        <span className="dl">today</span>
      </div>
    </section>
  );
}

function AssetDetailPage({ match }: RouteComponentProps<{ symbol: string }>) {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const symbol = match.params.symbol;
  const { tickerAggregates, transactions, quotes, fxRates, cashByCurrency, loading, refreshMarket } =
    usePortfolioData();
  const [displayCurrency] = useDisplayCurrency();
  const agg = tickerAggregates.find((t) => t.symbol === symbol);
  const quote = quotes[symbol];

  useEffect(() => {
    if (!quotes[symbol]) refreshMarket([symbol]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const trades = useMemo(
    () => transactions.filter((tx) => tx.symbol === symbol && (tx.type === "buy" || tx.type === "sell")),
    [transactions, symbol],
  );
  const marks: TradeMark[] = useMemo(
    () =>
      trades.map((tx) => ({
        date: parseDay(tx.date),
        type: tx.type === "sell" ? "sell" : "buy",
        price: tx.pricePerShare ?? 0,
      })),
    [trades],
  );
  const lastSell = trades.reduce<string | null>((d, tx) => (tx.type === "sell" && (!d || tx.date > d) ? tx.date : d), null);

  const buy = () => history.push(`${tabBase}/add-transaction`, { type: "buy", symbol });
  const sell = () => history.push(`${tabBase}/add-transaction`, { type: "sell", symbol });

  const header = (
    <IonHeader translucent>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref={tabBase} text={tabLabel} />
        </IonButtons>
        <IonTitle>{symbol}</IonTitle>
      </IonToolbar>
    </IonHeader>
  );

  if (!agg) {
    return (
      <IonPage className="hd-page">
        {header}
        <IonContent fullscreen>
          <div className="hd-empty">
            <div className="ic">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h2>No position in {symbol}</h2>
            <p>None of your accounts has a transaction for this symbol.</p>
            <button type="button" className="hd-btn primary" onClick={buy}>
              Add a buy
            </button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // A quote in a different currency than the ledger (rare: a cross-listed
  // symbol) is converted onto the ledger's scale, so every figure here is in
  // ONE currency — the one the user paid in.
  const ccy = agg.currency;
  const price = quote ? convert(quote.price, quote.currency, ccy, fxRates) : null;
  const marketLoading = !quote && loading.market;
  const fx = (n: number) => convert(n, ccy, displayCurrency, fxRates);
  const mv = price != null ? price * agg.totalShares : null;

  const subtitle = [quote?.shortName, quote?.exchange, ccy].filter(Boolean).join(" · ");
  const accounts = agg.perAccount;
  const single = accounts.length === 1;
  const openAccounts = accounts.filter((a) => a.shares > 1e-9);
  const lotCount = openAccounts.reduce((n, a) => n + a.lots.length, 0);
  const newestFirst = (lots: Lot[]) => [...lots].sort((a, b) => b.date.localeCompare(a.date));

  // ── Position facts ───────────────────────────────────────────────────────
  let facts: ReactNode;
  if (agg.closed) {
    facts = (
      <section className="hd-sec">
        <div className="hd-sec-h">Summary</div>
        <div className="hd-card hd-grid">
          <Cell k="Shares sold" v={fmtShares(agg.realizedShares)} />
          <Cell k="Avg holding period" v={fmtAge(agg.realizedAgeYears)} />
          <Cell k="Cost of shares sold" v={fmtCcy(agg.realizedCostBasis, ccy)} />
          <Cell k="Proceeds" v={fmtCcy(agg.realizedCostBasis + agg.realizedPL, ccy)} />
        </div>
      </section>
    );
  } else {
    const cells: { k: string; v: ReactNode; text?: boolean }[] = [
      { k: "Shares", v: fmtShares(agg.totalShares) },
      { k: "Avg cost", v: fmtCcy(agg.avgCost, ccy) },
      { k: "Cost basis", v: fmtCcy(agg.costBasis, ccy) },
      { k: "Avg time held", v: fmtAge(agg.avgAgeYears) },
    ];
    if (mv != null) {
      const total =
        cashValue(cashByCurrency, displayCurrency, fxRates) +
        positionsValue(tickerAggregates, quotes, displayCurrency, fxRates);
      if (total > 1e-9) cells.push({ k: "Portfolio weight", v: `${((fx(mv) / total) * 100).toFixed(1)}%` });
    }
    // One account and one lot: no account or lot list follows, so where and
    // when become two facts here instead.
    if (single && lotCount === 1) cells.push({ k: "Bought", v: fmtDay(parseDay(openAccounts[0].lots[0].date)), text: true });
    if (single) cells.push({ k: "Held in", v: accounts[0].account, text: true });
    facts = (
      <section className="hd-sec">
        <div className="hd-sec-h">Position</div>
        <div className="hd-card hd-grid">
          {cells.map((c, i) => (
            <Cell key={c.k} {...c} wide={i === cells.length - 1 && cells.length % 2 === 1} />
          ))}
        </div>
      </section>
    );
  }

  // ── Where it is held ─────────────────────────────────────────────────────
  let holdings: ReactNode = null;
  if (agg.closed) {
    const sold = accounts
      .filter((a) => a.realizedShares > 1e-9)
      .sort((a, b) => b.realizedPL - a.realizedPL);
    if (sold.length > 1) {
      holdings = (
        <section className="hd-sec">
          <div className="hd-sec-h">By account</div>
          <div className="hd-card">
            {sold.map((a) => {
              const r = a.realizedCostBasis > 1e-9 ? (a.realizedPL / a.realizedCostBasis) * 100 : 0;
              return (
                <div className="hd-row" key={a.account}>
                  <div className="l">
                    <div className="hd-name">{a.account}</div>
                    <div className="hd-meta">
                      {fmtShares(a.realizedShares)} sh sold · held {fmtAge(a.realizedAgeYears)}
                    </div>
                  </div>
                  <div className="r">
                    <div className="v num">{fmtSignedCcy(a.realizedPL, ccy)}</div>
                    <div className="g">
                      <span className={`num ${tone(r)}`}>{fmtSignedPct(r)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    }
  } else if (single) {
    // The one account is named in the Position grid, so only its lots are
    // listed — and only when there is more than one.
    const lots = newestFirst(accounts[0].lots);
    if (lots.length > 1) {
      holdings = (
        <section className="hd-sec">
          <div className="hd-sec-h">
            Current lots <span className="aside">{lots.length}</span>
          </div>
          <div className="hd-card">
            {lots.map((l, i) => (
              <LotRow key={`${l.date}-${i}`} lot={l} price={price} ccy={ccy} />
            ))}
          </div>
          <ShrinkNote lots={lots} />
        </section>
      );
    }
  } else {
    const worth = (a: AccountPosition) => (price != null ? a.shares * price : a.costBasis);
    const sorted = [...accounts].sort((a, b) => worth(b) - worth(a));
    holdings = (
      <section className="hd-sec">
        <div className="hd-sec-h">
          Accounts <span className="aside">{sorted.length}</span>
        </div>
        {sorted.map((a) => {
          const closed = a.shares <= 1e-9;
          const lots = newestFirst(a.lots);
          return (
            <div className={closed ? "hd-card hd-acct closed" : "hd-card hd-acct"} key={a.account}>
              <div className="hd-row">
                <div className="l">
                  <div className="hd-name">
                    {a.account}
                    {closed && <span className="hd-tag">Closed</span>}
                  </div>
                  <div className="hd-meta">
                    {closed
                      ? `All sold · ${fmtShares(a.realizedShares)} sh`
                      : `${fmtShares(a.shares)} sh · avg ${fmtCcy(a.avgCost, ccy)}`}
                  </div>
                </div>
                <div className="r">
                  {closed ? (
                    <>
                      <div className="v num">{fmtSignedCcy(a.realizedPL, ccy)}</div>
                      <div className="g">realized</div>
                    </>
                  ) : (
                    <Worth value={price != null ? a.shares * price : null} cost={a.costBasis} ccy={ccy} />
                  )}
                </div>
              </div>
              {lots.length > 0 && (
                <div className="hd-lots">
                  {lots.map((l, i) => (
                    <LotRow key={`${l.date}-${i}`} lot={l} price={price} ccy={ccy} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <ShrinkNote lots={accounts.flatMap((a) => a.lots)} />
      </section>
    );
  }

  // ── Realized, on a position that is still open ───────────────────────────
  let realized: ReactNode = null;
  if (!agg.closed && agg.realizedShares > 1e-9) {
    const r = agg.realizedCostBasis > 1e-9 ? (agg.realizedPL / agg.realizedCostBasis) * 100 : 0;
    const t = mv != null ? agg.realizedPL + (mv - agg.costBasis) : null;
    const tp = t != null ? (t / (agg.realizedCostBasis + agg.costBasis)) * 100 : 0;
    realized = (
      <section className="hd-sec">
        <div className="hd-sec-h">Realized</div>
        <div className="hd-card">
          <div className="hd-kv">
            <span className="k">Realized {agg.realizedPL < 0 ? "loss" : "gain"}</span>
            <span className="v">
              <span className="num">{fmtSignedCcy(agg.realizedPL, ccy)}</span>{" "}
              <span className={`num ${tone(r)}`}>{fmtSignedPct(r)}</span>
            </span>
          </div>
          <div className="hd-kv">
            <span className="k">Shares sold</span>
            <span className="v num">{fmtShares(agg.realizedShares)}</span>
          </div>
          <div className="hd-kv">
            <span className="k">Cost of shares sold</span>
            <span className="v num">{fmtCcy(agg.realizedCostBasis, ccy)}</span>
          </div>
          <div className="hd-kv">
            <span className="k">Avg holding period</span>
            <span className="v num">{fmtAge(agg.realizedAgeYears)}</span>
          </div>
          {t != null && (
            <div className="hd-kv total">
              <span className="k">Total return</span>
              <span className="v">
                <span className={`num ${tone(t)}`}>{fmtSignedCcy(t, ccy)}</span>{" "}
                <span className={`num ${tone(t)}`}>{fmtSignedPct(tp)}</span>
              </span>
            </div>
          )}
        </div>
        {t != null && <div className="hd-foot">Total return = realized + unrealized, over everything you ever paid.</div>}
      </section>
    );
  }

  return (
    <IonPage className="hd-page">
      {header}

      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{symbol}</IonTitle>
            {agg.closed && (
              <span slot="end" className="type-tag">
                Closed
              </span>
            )}
          </IonToolbar>
        </IonHeader>

        {marketLoading ? (
          <Sk w="55%" h={15} style={{ margin: "4px var(--gutter) 0" }} />
        ) : (
          <div className="hd-subtitle">{subtitle}</div>
        )}

        <Hero
          agg={agg}
          quote={price != null && quote ? { ...quote, price, change: convert(quote.change, quote.currency, ccy, fxRates) } : undefined}
          loading={marketLoading}
          ccy={ccy}
          displayCurrency={displayCurrency}
          fx={fx}
          lastSell={lastSell}
          onRetry={() => refreshMarket([symbol])}
        />

        {quote ? (
          <HoldingChart
            symbol={symbol}
            quote={quote}
            avgCost={!agg.closed && quote.currency === ccy ? agg.avgCost : null}
            marks={quote.currency === ccy ? marks : []}
          />
        ) : (
          marketLoading && (
            <section className="hd-sec">
              <Sk w="40%" h={22} />
              <Sk w="100%" h={170} style={{ marginTop: 12, borderRadius: 10 }} />
              <Sk w="100%" h={32} style={{ marginTop: 10 }} />
            </section>
          )
        )}

        {facts}
        {holdings}
        {realized}

        <section className="hd-sec">
          <div className="hd-card">
            <button
              type="button"
              className="hd-link"
              onClick={() => history.push(`${tabBase}/asset/${encodeURIComponent(symbol)}/transactions`)}
            >
              <span className="grow">Transactions</span>
              <span className="cnt num">{trades.length}</span>
              <ChevronRightIcon />
            </button>
            {/* Leaves the app, so an outward arrow — never a chevron. */}
            <a className="hd-link" href={yahooQuoteUrl(symbol)} target="_blank" rel="noopener noreferrer">
              <span className="grow">{quote ? "More on Yahoo Finance" : "View on Yahoo Finance"}</span>
              <ExternalLinkIcon />
            </a>
          </div>
        </section>
      </IonContent>

      {/* Buy/Sell in thumb reach, in the space the hidden tab bar leaves. Sell
          is tinted, never red: selling is not destructive. */}
      <IonFooter className="hd-footer">
        <div className={agg.closed ? "hd-actions one" : "hd-actions"}>
          <button type="button" className="hd-btn primary" onClick={buy}>
            {agg.closed ? "Buy again" : "Buy"}
          </button>
          {!agg.closed && (
            <button type="button" className="hd-btn secondary" onClick={sell}>
              Sell
            </button>
          )}
        </div>
      </IonFooter>
    </IonPage>
  );
}

export default AssetDetailPage;
