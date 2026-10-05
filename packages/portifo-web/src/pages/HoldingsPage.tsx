import {
  IonContent,
  IonHeader,
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
} from "@ionic/react";
import type { RefresherEventDetail } from "@ionic/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useHistory } from "react-router-dom";
import CurrencyPickerSheet from "../CurrencyPickerSheet";
import ActionSheetModal from "../components/ActionSheetModal";
import AddPortfolioModal from "../components/AddPortfolioModal";
import GrowthChart from "../components/GrowthChart";
import { ActionPlusIcon, CheckIcon } from "../components/ds";
import { getPortfolioHistory } from "../api/portfolio";
import type { HistoryPoint, HistoryRange, Quote } from "../api/market";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { convert, fmtCcy, fmtDay, fmtShares, fmtSignedCcy, fmtSignedPct, parseDay } from "../lib/fx";
import { useDisplayCurrency } from "../lib/displayCurrency";
import { cashValue } from "../lib/positions";

// The Portfolio tab, built from design-poc/portfolio-overview.html in the
// second design system (theme/ds.css). Read top to bottom:
//   1. The whole — cash and investments as one quiet headline, today's move
//      underneath without colouring the balance itself.
//   2. The journey — the value over time; its change opens a sheet separating
//      money added from investment gain.
//   3. The parts — stocks vs cash, each stock's share, today's movers, and the
//      holdings ledger (shares, value, total return).
//
// Everything follows the account picker in the bar: one account or all of
// them. Figures are in the display currency (the chip beside it); a stock's
// share is always of the whole, cash included.

type Row = {
  symbol: string;
  shares: number;
  quote: Quote | undefined;
  value: number;
  gain: number | null;
  gainPct: number | null;
  day: number | null;
  color: string;
};

type Closed = { symbol: string; realized: number; realizedPct: number; lastSale: string | null };

type Growth = { points: HistoryPoint[]; netDeposits: number; estimated: string[] };

const NO_GROWTH: Growth = { points: [], netDeposits: 0, estimated: [] };

// Last series per portfolio + scope + range + currency, so flipping back to a
// range redraws at once while the fresh one loads.
const growthCache = new Map<string, Growth>();

const HOLD_COLORS = [1, 2, 3, 4, 5].map((i) => `var(--ds-hold-${i})`);

const tone = (n: number) => (n > 1e-9 ? "positive" : n < -1e-9 ? "negative" : "");
const weight = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
const percent = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;
const sharesLabel = (n: number) => `${fmtShares(n)} ${n === 1 ? "share" : "shares"}`;

const icon = (body: ReactNode, size = 20) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {body}
  </svg>
);
const PLUS = icon(<path d="M12 5v14M5 12h14" />);
const CLOSE = icon(<path d="m6 6 12 12M18 6 6 18" />, 14);
const PORTFOLIO = icon(
  <>
    <rect x="3" y="7" width="18" height="14" rx="3" />
    <path d="M8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3M3 12h18M10 12v3h4v-3" />
  </>,
);
const SWITCH = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// The headline figure: one line, never wrapped or clipped. A long figure
// shrinks a pixel at a time until it fits, never below 22px.
function HeroValue({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("font-size");
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth && size > 22) el.style.fontSize = `${--size}px`;
  });
  return (
    <div ref={ref} className="po-hero-value money">
      {text}
    </div>
  );
}

function Pair({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="po-detail-pair">
      <span>{label}</span>
      <span className={`money ${className}`}>{value}</span>
    </div>
  );
}

function HoldingsPage() {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const {
    portfolios,
    activePortfolio,
    switchPortfolio,
    accounts,
    transactions,
    tickerAggregates,
    cashByCurrency,
    quotes,
    fxRates,
    loading,
    refreshAccounts,
    refreshTransactions,
    refreshMarket,
    hasActivity,
  } = usePortfolioData();
  const [ccy, setCcy] = useDisplayCurrency();

  const [scope, setScope] = useState("all");
  const [range, setRange] = useState<HistoryRange>("1Y");
  const [cashOpen, setCashOpen] = useState(false);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [portfolioSheetOpen, setPortfolioSheetOpen] = useState(false);
  const [addPortfolioOpen, setAddPortfolioOpen] = useState(false);

  // A picked account belongs to one portfolio; switching starts over at all.
  useEffect(() => {
    setScope("all");
    setCashOpen(false);
  }, [activePortfolio?.id]);

  const account = accounts.find((a) => a.id === scope) ?? null;
  const scopeLabel = account ? account.name : "All accounts";

  const openAggs = tickerAggregates.filter((t) => !t.closed);
  const openSymbols = openAggs.map((t) => t.symbol);
  const symbolsKey = openSymbols.join(",");

  useEffect(() => {
    if (openSymbols.length) refreshMarket(openSymbols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  // ── The series ───────────────────────────────────────────────────────────
  const growthKey = `${activePortfolio?.id}|${account?.id ?? "all"}|${range}|${ccy}`;
  const [growth, setGrowth] = useState<Growth>(() => growthCache.get(growthKey) ?? NO_GROWTH);
  const [growthFailed, setGrowthFailed] = useState(false);
  const growthRequest = useRef(0);

  const loadGrowth = useCallback(async () => {
    const id = ++growthRequest.current;
    try {
      const h = await getPortfolioHistory(range, ccy, account?.id);
      const next = {
        points: h.points,
        netDeposits: h.netDeposits ?? 0,
        estimated: [...h.estimatedTickers, ...h.estimatedCurrencies],
      };
      growthCache.set(growthKey, next);
      if (growthRequest.current === id) {
        setGrowth(next);
        setGrowthFailed(next.points.length < 2);
      }
    } catch {
      if (growthRequest.current === id) setGrowthFailed(true);
    }
  }, [range, ccy, account?.id, growthKey]);

  // The ledger is a dependency: a transaction added anywhere redraws the curve.
  useEffect(() => {
    setGrowth(growthCache.get(growthKey) ?? NO_GROWTH);
    setGrowthFailed(false);
    if (hasActivity) loadGrowth();
  }, [loadGrowth, growthKey, hasActivity, transactions, accounts]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    try {
      await Promise.all([
        refreshTransactions({ silent: true }),
        refreshAccounts({ silent: true }),
        refreshMarket(openSymbols),
        loadGrowth(),
      ]);
    } finally {
      e.detail.complete();
    }
  };

  // ── The parts, in the display currency ───────────────────────────────────
  // A position with no quote is valued at cost, as the total always has been.
  const valueOf = (symbol: string, shares: number, avgCost: number, native: string) => {
    const q = quotes[symbol];
    return q ? convert(q.price * shares, q.currency, ccy, fxRates) : convert(avgCost * shares, native, ccy, fxRates);
  };

  // Hues go by rank across the whole portfolio, so a stock keeps its colour
  // when the picker narrows to one account.
  const colorOf = new Map(
    [...openAggs]
      .sort((a, b) => valueOf(b.symbol, b.totalShares, b.avgCost, b.currency) - valueOf(a.symbol, a.totalShares, a.avgCost, a.currency))
      .map((t, i) => [t.symbol, HOLD_COLORS[i % HOLD_COLORS.length]]),
  );

  const rows: Row[] = [];
  const closed: Closed[] = [];
  for (const t of tickerAggregates) {
    const pa = account ? t.perAccount.find((p) => p.account === account.name) : null;
    if (account && !pa) continue;
    const shares = pa ? pa.shares : t.totalShares;
    if (shares > 1e-9) {
      const cost = pa ? pa.costBasis : t.costBasis;
      const q = quotes[t.symbol];
      let gain: number | null = null;
      let gainPct: number | null = null;
      let day: number | null = null;
      if (q) {
        // Return in the position's own currency, then converted: the
        // percentage is the investment's, not the exchange rate's.
        const native = convert(q.price, q.currency, t.currency, fxRates) * shares - cost;
        gain = convert(native, t.currency, ccy, fxRates);
        gainPct = cost > 1e-9 ? (native / cost) * 100 : null;
        day = convert(q.change * shares, q.currency, ccy, fxRates);
      }
      rows.push({
        symbol: t.symbol,
        shares,
        quote: q,
        value: valueOf(t.symbol, shares, cost / shares, t.currency),
        gain,
        gainPct,
        day,
        color: colorOf.get(t.symbol) ?? HOLD_COLORS[0],
      });
    } else {
      const realized = pa ? pa.realizedPL : t.realizedPL;
      const basis = pa ? pa.realizedCostBasis : t.realizedCostBasis;
      if (basis <= 1e-9) continue;
      const lastSale = transactions.reduce<string | null>(
        (d, tx) =>
          tx.type === "sell" && tx.symbol === t.symbol && (!account || tx.account === account.name) && (!d || tx.date > d)
            ? tx.date
            : d,
        null,
      );
      closed.push({
        symbol: t.symbol,
        realized: convert(realized, t.currency, ccy, fxRates),
        realizedPct: (realized / basis) * 100,
        lastSale,
      });
    }
  }
  rows.sort((a, b) => b.value - a.value);
  closed.sort((a, b) => (b.lastSale ?? "").localeCompare(a.lastSale ?? ""));

  const balancesOf = (a: (typeof accounts)[number]) =>
    Object.fromEntries(a.balances.map((b) => [b.currency, b.balance] as const));
  const cash = account ? cashValue(balancesOf(account), ccy, fxRates) : cashValue(cashByCurrency, ccy, fxRates);
  const cashByAccount = (account ? [account] : accounts)
    .map((a) => ({ id: a.id, name: a.name, value: cashValue(balancesOf(a), ccy, fxRates) }))
    .filter((a) => Math.abs(a.value) >= 0.005);
  const stocks = rows.reduce((s, r) => s + r.value, 0);
  const total = stocks + cash;

  const priced = rows.filter((r) => r.quote);
  const quotesPending = rows.length > priced.length && loading.market;
  // Cash alone has a day of exactly zero; holdings need their quotes first.
  const hasDay = rows.length === 0 || priced.length > 0;
  const day = priced.reduce((s, r) => s + (r.day ?? 0), 0);
  const dayPct = total - day > 1e-9 ? (day / (total - day)) * 100 : 0;
  const unrealized = priced.reduce((s, r) => s + (r.gain ?? 0), 0);

  // ── Growth over the range ────────────────────────────────────────────────
  // Ends at today's total, the figure printed above it. A day starts at
  // yesterday's close, so 1D agrees with Today.
  const pts = growth.points;
  const start = range === "1D" && hasDay && priced.length > 0 ? total - day : pts[0]?.close;
  const change = start != null && !quotesPending ? total - start : null;
  const investmentGain = change != null ? change - growth.netDeposits : null;

  // ── Today's movers: up to five of the strongest daily moves ──────────────
  const gainers = priced.filter((r) => (r.day ?? 0) > 0);
  const decliners = priced.filter((r) => (r.day ?? 0) < 0);
  const flat = priced.length - gainers.length - decliners.length;
  const pctOf = (r: Row) => r.quote?.changePercent ?? 0;
  const movers = [...gainers, ...decliners]
    .sort((a, b) => Math.abs(pctOf(b)) - Math.abs(pctOf(a)) || a.symbol.localeCompare(b.symbol))
    .slice(0, 5)
    .sort((a, b) => pctOf(b) - pctOf(a) || a.symbol.localeCompare(b.symbol));
  const maxMove = Math.max(...movers.map((r) => Math.abs(pctOf(r))), 0);

  const ledger = [
    ...rows.map((r) => ({ kind: "stock" as const, value: r.value, row: r })),
    { kind: "cash" as const, value: cash },
  ].sort((a, b) => b.value - a.value);

  const openHolding = (symbol: string) => history.push(`${tabBase}/asset/${encodeURIComponent(symbol)}`);
  const addTransaction = () => history.push(`${tabBase}/add-transaction`);
  const isEmpty = !hasActivity && !loading.accounts;
  const firstDay = pts[0]?.date;

  return (
    <IonPage className="tab-root-page po-page">
      <IonHeader className="po-header">
        <div className="po-navigation">
          <select
            className="po-scope"
            aria-label="Portfolio account"
            value={account ? account.id : "all"}
            onChange={(e) => {
              setScope(e.target.value);
              setCashOpen(false);
            }}
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="po-currency"
            aria-label={`Display currency, ${ccy}`}
            onClick={() => setCurrencySheetOpen(true)}
          >
            {ccy}
          </button>
        </div>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="po-heading">
          <h1>
            <button
              type="button"
              className="po-title"
              aria-label={`${activePortfolio?.name ?? "Portfolio"}, switch portfolio`}
              onClick={() => setPortfolioSheetOpen(true)}
            >
              {activePortfolio?.name ?? "Portfolio"}
              {SWITCH}
            </button>
          </h1>
          <button type="button" className="po-icon-button" aria-label="Add transaction" onClick={addTransaction}>
            {PLUS}
          </button>
        </div>

        {isEmpty ? (
          <div className="po-empty">
            <div className="po-empty-symbol">{PORTFOLIO}</div>
            <h2>A place for your portfolio.</h2>
            <p>Add your first deposit or purchase. We’ll bring your cash and holdings together here.</p>
            <button type="button" className="po-action" onClick={addTransaction}>
              Add your first transaction
            </button>
          </div>
        ) : (
          <>
            <section className="po-hero" aria-label="Portfolio value">
              <div className="po-hero-label">
                Total portfolio value
                {quotesPending && <span className="po-spinner" role="status" aria-label="Loading prices" />}
              </div>
              <HeroValue text={fmtCcy(total, ccy)} />
              <div className="po-hero-return" style={hasDay ? undefined : { visibility: "hidden" }}>
                <span className={`money ${tone(day)}`}>{fmtSignedCcy(day, ccy)}</span>
                <span className={`money po-return-percent ${tone(day)}`}>{fmtSignedPct(dayPct)}</span>
                <span className="po-return-label">Today</span>
              </div>
            </section>

            <section className="po-growth" aria-label="Portfolio value history">
              <div className="po-growth-heading">
                <h2>Portfolio growth</h2>
                {change != null && (
                  <button
                    type="button"
                    className={`po-period-change money ${tone(change)}`}
                    aria-label="Explain portfolio value change"
                    onClick={() => setGrowthOpen(true)}
                  >
                    {fmtSignedCcy(change, ccy)} <span className="po-info">ⓘ</span>
                  </button>
                )}
              </div>
              <GrowthChart points={pts} range={range} ccy={ccy} failed={growthFailed} onRange={setRange} />
            </section>

            <section className="po-section po-allocation" aria-label="Portfolio allocation">
              <div className="po-section-heading">
                <h2>Breakdown</h2>
                <span className="meta">{account ? "This account" : "All accounts"}</span>
              </div>
              {(() => {
                const parts = [
                  { label: "Stocks", value: stocks, color: "var(--ds-accent)" },
                  { label: "Cash", value: cash, color: "var(--ds-cash)" },
                ];
                return (
                  <>
                    <div
                      className="po-allocation-bar"
                      role="img"
                      aria-label={parts.map((p) => `${p.label} ${percent(weight(p.value, total))}`).join(", ")}
                    >
                      {parts
                        .filter((p) => p.value > 0)
                        .map((p) => (
                          <span
                            key={p.label}
                            className="po-allocation-segment"
                            style={{ flex: p.value, background: p.color }}
                            title={`${p.label} · ${percent(weight(p.value, total))}`}
                          />
                        ))}
                    </div>
                    <div className="po-allocation-legend">
                      {parts.map((p) => (
                        <div className="po-allocation-stat" key={p.label}>
                          <div className="po-legend-label">
                            <span className="po-legend-dot" style={{ background: p.color }} />
                            {p.label}
                          </div>
                          <span className="po-legend-percent money">{percent(weight(p.value, total))}</span>
                          <div className="po-legend-value money">{fmtCcy(p.value, ccy)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
              {rows.length > 0 ? (
                <div className="po-stock-breakdown">
                  <div className="po-stock-breakdown-heading">
                    <h3>Stock breakdown</h3>
                    <span>% of portfolio</span>
                  </div>
                  <div className="po-allocation-weights">
                    {rows.map((r) => (
                      <button
                        key={r.symbol}
                        type="button"
                        className="po-allocation-weight"
                        aria-label={`${r.symbol}, ${percent(weight(r.value, total))} of portfolio, view holding detail`}
                        onClick={() => openHolding(r.symbol)}
                      >
                        <span className="po-legend-label">
                          <span className="po-legend-dot" style={{ background: r.color }} aria-hidden="true" />
                          {r.symbol}
                        </span>
                        <span
                          className="po-weight-track"
                          aria-hidden="true"
                          style={{ "--weight-color": r.color } as CSSProperties}
                        >
                          <i style={{ width: `${Math.max(0, Math.min(100, weight(r.value, total)))}%` }} />
                        </span>
                        <span className="money">{percent(weight(r.value, total))}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="po-allocation-note">No stock holdings. Your portfolio is held in cash.</p>
              )}
            </section>

            <section className="po-section po-movers" aria-label="Today’s Movers">
              <div className="po-section-heading">
                <h2>Today’s Movers</h2>
              </div>
              {movers.length > 0 ? (
                <>
                  <div className="po-movers-context">
                    <span>
                      {gainers.length} up · {decliners.length} down{flat ? ` · ${flat} flat` : ""}
                    </span>
                    <span>{priced.length > 5 ? "Top 5 · % change" : "Daily % change"}</span>
                  </div>
                  <div
                    className="po-movers-chart"
                    role="group"
                    aria-label="Daily percentage changes; gains rise above zero and declines fall below zero"
                    style={{ "--mover-count": movers.length } as CSSProperties}
                  >
                    {movers.map((r) => {
                      const pct = pctOf(r);
                      const t = tone(r.day ?? 0);
                      const height = maxMove ? (Math.abs(pct) / maxMove) * 38 : 0;
                      return (
                        <button
                          key={r.symbol}
                          type="button"
                          className="po-mover-column"
                          aria-label={`${r.symbol}, ${fmtSignedPct(pct)} today, position change ${fmtSignedCcy(r.day ?? 0, ccy)}, view holding detail`}
                          onClick={() => openHolding(r.symbol)}
                        >
                          <span className={`po-mover-percent money ${t}`}>{fmtSignedPct(pct)}</span>
                          <span className="po-mover-bar-plot" aria-hidden="true">
                            <span
                              className={`po-mover-bar ${t}`}
                              style={{ "--bar-height": `${height.toFixed(3)}px` } as CSSProperties}
                            />
                          </span>
                          <span className="po-mover-symbol">{r.symbol}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="po-movers-empty">
                  {rows.length === 0
                    ? "No stock movers yet. Add an investment to see its daily change here."
                    : priced.length === 0
                      ? loading.market
                        ? "Getting today’s prices…"
                        : "Today’s prices are unavailable right now."
                      : "No price changes in your holdings today."}
                </p>
              )}
            </section>

            <section className="po-section po-holdings" aria-label="All holdings">
              <div className="po-section-heading">
                <h2>
                  Holdings <span className="meta">{rows.length}</span>
                </h2>
              </div>
              <div className="po-list-caption">
                <span>Holding / shares</span>
                <span>Value / total return</span>
              </div>
              <div>
                {ledger.map((item) => {
                  if (item.kind === "cash") {
                    return (
                      <div key="cash">
                        <button
                          type="button"
                          className="po-holding-row"
                          aria-expanded={cashOpen}
                          aria-controls="po-cash-accounts"
                          onClick={() => setCashOpen((o) => !o)}
                        >
                          <span className="po-holding-summary">
                            <span className="po-holding-identity">
                              <span className="po-holding-symbol">
                                <span className="po-legend-dot cash" aria-hidden="true" />
                                Cash
                              </span>
                              <span className="po-holding-meta">Uninvested</span>
                            </span>
                            <span className="po-holding-end">
                              <span className="po-holding-value money">{fmtCcy(cash, ccy)}</span>
                              <span className="po-holding-meta">
                                {cashOpen ? "Hide" : "By"} account {cashOpen ? "⌃" : "⌄"}
                              </span>
                            </span>
                          </span>
                        </button>
                        <div className="po-cash-accounts" id="po-cash-accounts" hidden={!cashOpen}>
                          {cashByAccount.length > 0 ? (
                            cashByAccount.map((a) => (
                              <div className="po-cash-account" key={a.id}>
                                <span>{a.name}</span>
                                <span className="money">{fmtCcy(a.value, ccy)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="po-cash-account">
                              <span>No cash balances</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  const r = item.row;
                  return (
                    <button
                      key={r.symbol}
                      type="button"
                      className="po-holding-row"
                      aria-label={`${r.symbol}, ${sharesLabel(r.shares)}, ${fmtCcy(r.value, ccy)}, view holding detail`}
                      onClick={() => openHolding(r.symbol)}
                    >
                      <span className="po-holding-summary">
                        <span className="po-holding-identity">
                          <span className="po-holding-symbol">
                            <span className="po-legend-dot" style={{ background: r.color }} aria-hidden="true" />
                            {r.symbol}
                          </span>
                          <span className="po-holding-meta">{sharesLabel(r.shares)}</span>
                        </span>
                        <span className="po-holding-end">
                          <span className="po-holding-value money">{fmtCcy(r.value, ccy)}</span>
                          {r.gain != null ? (
                            <span className={`po-holding-return money ${tone(r.gain)}`}>
                              {fmtSignedCcy(r.gain, ccy)}
                              {r.gainPct != null && ` · ${fmtSignedPct(r.gainPct)}`}
                            </span>
                          ) : (
                            <span className="po-holding-return secondary">
                              {loading.market ? " " : "At cost · no quote"}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Every share sold: no value to rank, so after the ledger, with
                  the realized result where the return would be. */}
              {closed.length > 0 && (
                <>
                  <div className="po-list-caption po-closed-caption">
                    <span>Closed / last sale</span>
                    <span>Realized return</span>
                  </div>
                  {closed.map((c) => (
                    <button
                      key={c.symbol}
                      type="button"
                      className="po-holding-row"
                      aria-label={`${c.symbol}, closed, realized ${fmtSignedCcy(c.realized, ccy)}, view holding detail`}
                      onClick={() => openHolding(c.symbol)}
                    >
                      <span className="po-holding-summary">
                        <span className="po-holding-identity">
                          <span className="po-holding-symbol">{c.symbol}</span>
                          <span className="po-holding-meta">
                            {c.lastSale ? `Sold ${fmtDay(parseDay(c.lastSale))}` : "Closed"}
                          </span>
                        </span>
                        <span className="po-holding-end">
                          <span className={`po-holding-value money ${tone(c.realized)}`}>
                            {fmtSignedCcy(c.realized, ccy)}
                          </span>
                          <span className={`po-holding-return money ${tone(c.realized)}`}>
                            {fmtSignedPct(c.realizedPct)}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </section>
          </>
        )}

        <IonModal
          isOpen={growthOpen}
          onDidDismiss={() => setGrowthOpen(false)}
          initialBreakpoint={1}
          breakpoints={[0, 1]}
          handle={false}
          className="auto-sheet po-sheet"
          aria-labelledby="po-growth-title"
        >
          <div className="po-sheet-body">
            <div className="po-sheet-grabber" aria-hidden="true" />
            <div className="po-sheet-header">
              <h2 id="po-growth-title">Behind the growth</h2>
              <button type="button" className="po-close-sheet" aria-label="Close dialog" onClick={() => setGrowthOpen(false)}>
                {CLOSE}
              </button>
            </div>
            <p className="po-sheet-notice">
              {range === "All" && firstDay ? `Since ${fmtDay(new Date(firstDay))}` : `${range} period`} · {scopeLabel}
              <br />
              Value growth includes money added to your portfolio. It isn’t an investment return percentage.
            </p>
            {start != null && change != null && investmentGain != null && (
              <>
                <Pair label="Starting value" value={fmtCcy(start, ccy)} />
                <Pair label="Net deposits" value={fmtSignedCcy(growth.netDeposits, ccy)} />
                <Pair label="Investment gain / loss" value={fmtSignedCcy(investmentGain, ccy)} className={tone(investmentGain)} />
                <Pair label="Ending value" value={fmtCcy(total, ccy)} />
                <Pair label="Total value change" value={fmtSignedCcy(change, ccy)} className={tone(change)} />
              </>
            )}
            <p className="po-sheet-notice">
              Current unrealized gain on your stock holdings:{" "}
              <span className={`money ${tone(unrealized)}`}>{fmtSignedCcy(unrealized, ccy)}</span>.
              {growth.estimated.length > 0 && ` History for ${growth.estimated.join(", ")} is estimated.`}
            </p>
          </div>
        </IonModal>

        <CurrencyPickerSheet
          isOpen={currencySheetOpen}
          selected={ccy}
          onClose={() => setCurrencySheetOpen(false)}
          onSelect={setCcy}
        />

        <ActionSheetModal
          isOpen={portfolioSheetOpen}
          onClose={() => setPortfolioSheetOpen(false)}
          title="Portfolio"
          subtitle="Switch or create"
          actions={[
            ...portfolios.map((p) => ({
              label: p.name,
              icon: p.id === activePortfolio?.id ? <CheckIcon /> : undefined,
              onClick: () => {
                if (p.id !== activePortfolio?.id) switchPortfolio(p.id);
              },
            })),
            { label: "New Portfolio", icon: <ActionPlusIcon />, onClick: () => setAddPortfolioOpen(true) },
          ]}
        />

        <AddPortfolioModal isOpen={addPortfolioOpen} onClose={() => setAddPortfolioOpen(false)} />
      </IonContent>
    </IonPage>
  );
}

export default HoldingsPage;
