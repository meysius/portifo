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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useHistory } from "react-router-dom";
import type { RouteComponentProps } from "react-router-dom";
import HoldingChart from "../components/HoldingChart";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { BACK_ICON } from "../lib/backIcon";
import { convert, fmtAge, fmtCcy, fmtDay, fmtShares, fmtSignedCcy, fmtSignedPct, parseDay } from "../lib/fx";
import type { AccountPosition, Lot, TickerAgg } from "../lib/positions";

// The holding screen, built from design-poc/holding-detail.html, in the
// second design system (theme/ds.css). Read top to bottom:
//   1. Your money — what the position is worth, and the unrealized return.
//   2. The context — today's return before the share price, then a quiet
//      price-history chart.
//   3. The ownership — a compact position ledger, then the accounts it is
//      held in; an account expands in place to its open purchases, and a
//      purchase pushes its transaction.
//
// Colour is reserved for returns: the headline value stays neutral, and a
// return is tinted (with its percentage on a tinted pill in the hero).
//
// No quote means no value, no today and no unrealized return — shares and cost
// still show, and say what they are. A closed position headlines its realized
// gain instead of a $0 value, and needs no quote at all.
//
// Every figure is in the security's own currency (the one it was bought in);
// display-currency conversion is deliberately left out so the ledger reads
// unambiguously.

const tone = (n: number) => (n > 1e-9 ? "positive" : n < -1e-9 ? "negative" : "");
const pctOf = (n: number, base: number) => (base > 1e-9 ? (n / base) * 100 : 0);
const shrunk = (l: Lot) => Math.abs(l.shares - l.origShares) > 1e-6;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Quote times are shown in the exchange's clock, as the study does.
const ET: Intl.DateTimeFormatOptions = { timeZone: "America/New_York" };
const fmtEtTime = (d: Date) => `${d.toLocaleTimeString("en-US", { ...ET, hour: "numeric", minute: "2-digit" })} ET`;
const fmtEtDay = (d: Date) => d.toLocaleDateString("en-US", { ...ET, month: "short", day: "2-digit" });
const fmtEtStamp = (d: Date) =>
  `${d.toLocaleDateString("en-US", { ...ET, month: "short", day: "2-digit", year: "numeric" })}, ${fmtEtTime(d)}`;


const Chevron = () => (
  <svg
    width="13"
    height="16"
    viewBox="0 0 16 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6 5 5 5-5 5" />
  </svg>
);

// The headline figure: one line, never wrapped or clipped. A long figure starts
// at the compact size, then shrinks a pixel at a time until it fits, never
// below 22px.
function HeroValue({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("font-size");
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth && size > 22) el.style.fontSize = `${--size}px`;
  });
  return (
    <div ref={ref} className={`hd-hero-value money ${text.length > 12 ? "compact" : ""} ${className}`}>
      {text}
    </div>
  );
}

function Metric({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div>
      <div className="hd-metric-label">{label}</div>
      <div className={`money ${className}`}>{value}</div>
    </div>
  );
}

function ReturnPill({ value, base }: { value: number; base: number }) {
  return <span className={`money hd-pill ${tone(value)}`}>{fmtSignedPct(pctOf(value, base))}</span>;
}

function SectionHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="hd-section-heading">
      <h2>{title}</h2>
      {meta && <span className="meta">{meta}</span>}
    </div>
  );
}

function TextLink({ children, onClick, style }: { children: ReactNode; onClick: () => void; style?: CSSProperties }) {
  return (
    <button type="button" className="hd-text-link" onClick={onClick} style={style}>
      {children}
    </button>
  );
}

const AccountingNote = ({ lots }: { lots: Lot[] }) =>
  lots.some(shrunk) ? (
    <div className="hd-accounting-note">
      After a sale, remaining shares decrease proportionally across every purchase. Original purchase prices do not
      change.
    </div>
  ) : null;

// One purchase, named by its date. A sale shrinks every open purchase in its
// account pro rata (average cost), so a shrunk one says "remaining"; its price
// never changes.
function LotRow({
  lot,
  price,
  ccy,
  compact,
  onOpen,
}: {
  lot: Lot;
  price: number | null;
  ccy: string;
  compact?: boolean;
  onOpen: () => void;
}) {
  const pl = price != null ? (price - lot.pricePerShare) * lot.shares : null;
  return (
    <button
      type="button"
      className={compact ? "hd-lot compact" : "hd-lot"}
      onClick={onOpen}
      aria-label={`Purchase on ${fmtDay(parseDay(lot.date))}, ${fmtShares(lot.shares)} shares, view transaction`}
    >
      <div>
        <div className="hd-lot-date">{fmtDay(parseDay(lot.date))}</div>
        <div className="hd-lot-meta">
          {fmtShares(lot.shares)} {shrunk(lot) ? "remaining" : "shares"} ×{" "}
          <span className="money">{fmtCcy(lot.pricePerShare, ccy)}</span>
        </div>
      </div>
      <div className="hd-lot-end">
        {pl != null ? (
          <div>
            <span className={`money ${tone(pl)}`}>{fmtSignedCcy(pl, ccy)}</span>
            <small className="money">{fmtSignedPct(pctOf(pl, lot.costBasis))}</small>
          </div>
        ) : (
          <div>
            <span className="money">{fmtCcy(lot.costBasis, ccy)}</span>
            <small>Cost basis</small>
          </div>
        )}
      </div>
    </button>
  );
}

// The only purchase in the only account: the hero already carries its value
// and return, so the row names it and opens it — nothing more.
function OnlyLotRow({ lot, onOpen }: { lot: Lot; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="hd-lot compact"
      onClick={onOpen}
      aria-label={`View purchase transaction on ${fmtDay(parseDay(lot.date))}`}
    >
      <div>
        <div className="hd-lot-date">{fmtDay(parseDay(lot.date))}</div>
        <div className="hd-lot-meta">Original purchase · Held {fmtAge(lot.ageYears)}</div>
      </div>
      <div className="hd-lot-end">
        <span className="hd-lot-details">Details</span>
      </div>
    </button>
  );
}

function Hero({
  agg,
  ccy,
  price,
  quoteLoading,
}: {
  agg: TickerAgg;
  ccy: string;
  price: number | null;
  quoteLoading: boolean;
}) {
  if (agg.closed) {
    return (
      <section className="hd-hero" aria-label="Position summary">
        <div className="hd-hero-label">
          Realized {agg.realizedPL < -1e-9 ? "loss" : "gain"} · {ccy}
          <span className="hd-badge">Closed</span>
        </div>
        <HeroValue text={fmtSignedCcy(agg.realizedPL, ccy)} className={tone(agg.realizedPL)} />
        <div className="hd-hero-return">
          <ReturnPill value={agg.realizedPL} base={agg.realizedCostBasis} />
          <span className="hd-return-label">Return on sold shares</span>
        </div>
      </section>
    );
  }
  if (price == null) {
    return (
      <section className="hd-hero" aria-label="Position summary">
        <div className="hd-hero-label">Position value · {ccy}</div>
        <div className="hd-hero-unavailable">{quoteLoading ? "Getting the latest quote…" : "Value unavailable"}</div>
        <p className="hd-hero-subtext">
          {fmtShares(agg.totalShares)} shares held · {fmtCcy(agg.costBasis, ccy)} invested
        </p>
      </section>
    );
  }
  const value = price * agg.totalShares;
  const pl = value - agg.costBasis;
  return (
    <section className="hd-hero" aria-label="Position summary">
      <div className="hd-hero-label">Position value · {ccy}</div>
      <HeroValue text={fmtCcy(value, ccy)} />
      <div className="hd-hero-return">
        <span className={`money ${tone(pl)}`}>{fmtSignedCcy(pl, ccy)}</span>
        <ReturnPill value={pl} base={agg.costBasis} />
        <span className="hd-return-label">Unrealized return</span>
      </div>
    </section>
  );
}

function AssetDetailPage({ match }: RouteComponentProps<{ symbol: string }>) {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const symbol = match.params.symbol;
  const { tickerAggregates, transactions, quotes, fxRates, loading, refreshMarket } = usePortfolioData();
  const agg = tickerAggregates.find((t) => t.symbol === symbol);
  const quote = quotes[symbol];
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!quotes[symbol]) refreshMarket([symbol]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const lastSell = useMemo(
    () =>
      transactions.reduce<string | null>(
        (d, tx) => (tx.symbol === symbol && tx.type === "sell" && (!d || tx.date > d) ? tx.date : d),
        null,
      ),
    [transactions, symbol],
  );

  const assetPath = `${tabBase}/asset/${encodeURIComponent(symbol)}`;
  const openTx = (id: string) => history.push(`${tabBase}/transaction/${id}`);
  const openHistory = (query: Record<string, string>) =>
    history.push(`${assetPath}/transactions?${new URLSearchParams(query)}`);
  const buy = () => history.push(`${tabBase}/add-transaction`, { type: "buy", symbol });
  const sell = () => history.push(`${tabBase}/add-transaction`, { type: "sell", symbol });
  const toggle = (account: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(account)) next.add(account);
      return next;
    });

  const ccy = agg?.currency;
  const header = (
    <IonHeader translucent>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref={tabBase} text={tabLabel} icon={BACK_ICON} />
        </IonButtons>
        <IonTitle>{symbol}</IonTitle>
      </IonToolbar>
    </IonHeader>
  );
  const largeTitle = (
    <IonHeader collapse="condense">
      <IonToolbar>
        <IonTitle size="large">{symbol}</IonTitle>
      </IonToolbar>
    </IonHeader>
  );

  if (!agg || !ccy) {
    return (
      <IonPage className="hd-page">
        {header}
        <IonContent fullscreen>
          {largeTitle}
          {/* Until the ledger has loaded, "not found" would be a guess. */}
          {!loading.transactions && (
            <div className="hd-empty">
              <div className="hd-empty-symbol">
                <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                  <circle cx="10" cy="10" r="6" />
                  <path d="m15 15 5 5" />
                </svg>
              </div>
              <h2>No holding found</h2>
              <p>
                There isn’t a position for {symbol} in this portfolio. It may have been removed, or this link may be out
                of date.
              </p>
              <button
                type="button"
                className="hd-action primary"
                onClick={() => (history.length > 1 ? history.goBack() : history.replace(tabBase))}
              >
                Back to {tabLabel}
              </button>
            </div>
          )}
        </IonContent>
      </IonPage>
    );
  }

  // A quote in a different currency than the ledger (rare: a cross-listed
  // symbol) is converted onto the ledger's scale, so every figure here is in
  // ONE currency — the one the user paid in.
  const price = quote ? convert(quote.price, quote.currency, ccy, fxRates) : null;
  const quoteLoading = !quote && loading.market;
  const accounts = agg.perAccount;
  const openAccounts = accounts.filter((a) => a.shares > 1e-9);
  const single = accounts.length === 1 && !agg.closed;
  const newestFirst = (lots: Lot[]) => [...lots].sort((a, b) => b.date.localeCompare(a.date));
  const company = [quote?.shortName, quote?.exchange].filter(Boolean);
  const quoteTime = quote?.marketTime ? new Date(quote.marketTime) : null;

  // ── Today, then the market ─────────────────────────────────────────────────
  let market: ReactNode = null;
  if (agg.closed) {
    market = null;
  } else if (quote && price != null) {
    const day = convert(quote.change, quote.currency, ccy, fxRates) * agg.totalShares;
    const open = quote.marketState === "REGULAR";
    market = (
      <section className="hd-market" aria-label="Today and share price">
        <div className="hd-market-numbers">
          <div>
            <div className="hd-metric-label">Today’s return</div>
            <div className={`hd-metric-main money ${tone(day)}`}>{fmtSignedCcy(day, ccy)}</div>
            <div className={`hd-metric-foot money ${tone(day)}`}>{fmtSignedPct(quote.changePercent)}</div>
          </div>
          <div>
            <div className="hd-metric-label">Share price</div>
            <div className="hd-metric-main money">{fmtCcy(price, ccy)}</div>
            {quoteTime && (
              <div className="hd-metric-foot secondary">
                <span className={open ? "hd-live-dot" : "hd-live-dot closed"} />
                {open ? `At ${fmtEtTime(quoteTime)}` : `At close · ${fmtEtDay(quoteTime)}`}
              </div>
            )}
          </div>
        </div>
        <HoldingChart symbol={symbol} ccy={quote.currency} />
      </section>
    );
  } else {
    market = quoteLoading ? (
      <div className="hd-quote-note loading" role="status">
        <span className="hd-spinner" aria-hidden="true" />
        <div>
          <strong>Loading market data</strong>
          Your shares and cost are available below. Value and returns will appear when a quote arrives.
        </div>
      </div>
    ) : (
      <div className="hd-quote-note" role="status">
        <strong>We couldn’t get a current quote</strong>
        Market value, today’s change and unrealized return are unavailable. Your purchase details are still here.
        <TextLink onClick={() => refreshMarket([symbol])}>
          Try again <span aria-hidden="true">↻</span>
        </TextLink>
      </div>
    );
  }

  // ── The position ledger ────────────────────────────────────────────────────
  const position = agg.closed ? (
    <section className="hd-section">
      <SectionHeading title="Position closed" meta="No shares held" />
      <div className="hd-position-grid">
        <Metric label="Shares sold" value={fmtShares(agg.realizedShares)} />
        <Metric label="Cost of sold shares" value={fmtCcy(agg.realizedCostBasis, ccy)} />
        <Metric label="Avg. holding period" value={fmtAge(agg.realizedAgeYears)} />
        <Metric label="Last sale" value={lastSell ? fmtDay(parseDay(lastSell)) : "—"} />
      </div>
    </section>
  ) : (
    <section className="hd-section">
      <SectionHeading title="Your position" meta={plural(openAccounts.length, "account")} />
      <div className="hd-position-grid">
        <Metric label="Shares held" value={fmtShares(agg.totalShares)} />
        <Metric label="Average cost / share" value={fmtCcy(agg.avgCost, ccy)} />
        <Metric label="Total cost" value={fmtCcy(agg.costBasis, ccy)} />
        <Metric label="Average age" value={fmtAge(agg.avgAgeYears)} />
      </div>
    </section>
  );

  // ── Where it is held ───────────────────────────────────────────────────────
  let holdings: ReactNode;
  if (single) {
    // One account: identified once, its purchases listed open beneath it.
    const a = accounts[0];
    const lots = newestFirst(a.lots);
    holdings = (
      <section className="hd-section">
        <SectionHeading title="Held in" />
        <div className="hd-account single">
          <div className="hd-account-head">
            <div className="hd-account-name">{a.account}</div>
            <div className="hd-account-meta">
              {lots.length === 1 ? "One purchase" : `${lots.length} open purchases`}
            </div>
          </div>
          <div className="hd-account-detail">
            <div className="hd-purchases">
              <div className="hd-lots-heading">
                <span>{lots.length === 1 ? "Purchase" : "Open purchases"}</span>
                <span>{lots.length === 1 ? "Read-only" : price == null ? "Cost basis" : "Unrealized return"}</span>
              </div>
              {lots.length === 1 ? (
                <OnlyLotRow lot={lots[0]} onOpen={() => openTx(lots[0].txId)} />
              ) : (
                lots.map((l) => (
                  <LotRow key={l.txId} lot={l} price={price} ccy={ccy} compact onOpen={() => openTx(l.txId)} />
                ))
              )}
              <AccountingNote lots={lots} />
            </div>
          </div>
        </div>
      </section>
    );
  } else {
    // Several accounts (or a closed position): value and gain visible at once,
    // cost and purchases revealed in place.
    const worth = (a: AccountPosition) =>
      a.shares > 1e-9 ? (price != null ? a.shares * price : a.costBasis) : -Infinity;
    const sorted = [...accounts].sort((a, b) => worth(b) - worth(a) || b.realizedPL - a.realizedPL);
    holdings = (
      <section className="hd-section">
        <SectionHeading
          title={agg.closed ? "Realized by account" : "Accounts"}
          meta={plural(sorted.length, "account")}
        />
        {sorted.map((a) => {
          const open = expanded.has(a.account);
          const exited = a.shares <= 1e-9;
          const lots = newestFirst(a.lots);
          const value = price != null ? a.shares * price : null;
          const pl = value != null ? value - a.costBasis : null;
          const detailId = `hd-acct-${a.account.replace(/\W+/g, "-")}`;
          return (
            <div className="hd-account" key={a.account}>
              <button
                type="button"
                className="hd-account-toggle"
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => toggle(a.account)}
              >
                <span className="hd-account-title">
                  <span className="hd-account-identity">
                    <span className="hd-account-name">{a.account}</span>
                    <span className="hd-account-meta">
                      {exited
                        ? `${fmtShares(a.realizedShares)} shares sold · Closed`
                        : `${fmtShares(a.shares)} shares · ${plural(lots.length, "purchase")}`}
                    </span>
                  </span>
                  <span className="hd-disclosure" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </span>
                <span className="hd-account-value">
                  {exited ? (
                    <>
                      <span className={`money ${tone(a.realizedPL)}`}>{fmtSignedCcy(a.realizedPL, ccy)}</span>
                      <span className={`money hd-account-gain ${tone(a.realizedPL)}`}>
                        {fmtSignedPct(pctOf(a.realizedPL, a.realizedCostBasis))}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="money">{fmtCcy(value ?? a.costBasis, ccy)}</span>
                      <span className={`money hd-account-gain ${pl != null ? tone(pl) : ""}`}>
                        {pl != null
                          ? `${fmtSignedCcy(pl, ccy)} · ${fmtSignedPct(pctOf(pl, a.costBasis))}`
                          : "Cost basis"}
                      </span>
                    </>
                  )}
                </span>
              </button>
              <div id={detailId} className="hd-account-detail" hidden={!open}>
                {open &&
                  (exited ? (
                    <>
                      <div className="hd-account-stats">
                        <Metric label="Cost of sold shares" value={fmtCcy(a.realizedCostBasis, ccy)} />
                        <Metric label="Avg. holding period" value={fmtAge(a.realizedAgeYears)} />
                      </div>
                      <TextLink onClick={() => openHistory({ account: a.account })}>
                        View transactions <Chevron />
                      </TextLink>
                    </>
                  ) : (
                    <>
                      <div className="hd-account-stats">
                        <Metric label="Avg. cost/share" value={fmtCcy(a.avgCost, ccy)} />
                        <Metric label="Cost" value={fmtCcy(a.costBasis, ccy)} />
                        <Metric label="Avg. age" value={fmtAge(a.avgAgeYears)} />
                      </div>
                      {a.realizedShares > 1e-9 && (
                        <div className="hd-realized-note">
                          Already realized{" "}
                          <span className={`money ${tone(a.realizedPL)}`}>{fmtSignedCcy(a.realizedPL, ccy)}</span>
                        </div>
                      )}
                      <div className="hd-purchases">
                        <div className="hd-lots-heading">
                          <span>{plural(lots.length, "open purchase")}</span>
                          <span>{price == null ? "Cost basis" : "Unrealized return"}</span>
                        </div>
                        {lots.map((l) => (
                          <LotRow key={l.txId} lot={l} price={price} ccy={ccy} onOpen={() => openTx(l.txId)} />
                        ))}
                        <AccountingNote lots={lots} />
                      </div>
                    </>
                  ))}
              </div>
            </div>
          );
        })}
      </section>
    );
  }

  // ── Already realized, on a position that is still open ─────────────────────
  // Kept apart from the open position's return: two different percentages on
  // two different bases.
  const realized =
    !agg.closed && agg.realizedShares > 1e-9 ? (
      <section className="hd-section">
        <SectionHeading title="Already realized" meta="Sold shares" />
        <div className="hd-realized-summary">
          <span className={`money ${tone(agg.realizedPL)}`}>{fmtSignedCcy(agg.realizedPL, ccy)}</span>
          <ReturnPill value={agg.realizedPL} base={agg.realizedCostBasis} />
        </div>
        <p className="hd-realized-note">
          From {fmtShares(agg.realizedShares)} {Math.abs(agg.realizedShares - 1) < 1e-9 ? "share" : "shares"} sold.
          Separate from the return on your current position.
        </p>
        <div className="hd-position-grid">
          <Metric label="Cost of sold shares" value={fmtCcy(agg.realizedCostBasis, ccy)} />
          <Metric label="Avg. holding period" value={fmtAge(agg.realizedAgeYears)} />
        </div>
        <TextLink onClick={() => openHistory({ type: "sell" })} style={{ marginTop: 18 }}>
          View sales <Chevron />
        </TextLink>
      </section>
    ) : null;

  return (
    <IonPage className="hd-page">
      {header}

      <IonContent fullscreen>
        {largeTitle}
        {/* Reserves its line while the quote loads, so nothing below jumps. */}
        {(company.length > 0 || quoteLoading) && (
          <div className="hd-company">
            {company.length > 0
              ? company.map((part, i) => (
                  <span key={i}>
                    {i > 0 && <span className="dot">·</span>}
                    {part}
                  </span>
                ))
              : " "}
          </div>
        )}

        <Hero agg={agg} ccy={ccy} price={price} quoteLoading={quoteLoading} />
        {market}
        {position}
        {holdings}
        {realized}

        <div className="hd-footer-note">
          All amounts in {ccy} · Average-cost accounting
          {!agg.closed && price != null && quoteTime && (
            <>
              <br />
              Quote as of {fmtEtStamp(quoteTime)}
            </>
          )}
        </div>
      </IonContent>

      {/* Sell is tinted, never red: selling is not destructive. */}
      <IonFooter className="hd-actions">
        <button type="button" className="hd-action primary" onClick={buy}>
          {agg.closed ? "Buy again" : "Buy"}
        </button>
        {!agg.closed && (
          <button type="button" className="hd-action" onClick={sell}>
            Sell
          </button>
        )}
      </IonFooter>
    </IonPage>
  );
}

export default AssetDetailPage;
