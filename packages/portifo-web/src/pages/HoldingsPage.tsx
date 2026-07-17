import {
  IonAvatar,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { refreshOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import type { RefresherEventDetail } from "@ionic/react";
import { useHistory } from "react-router-dom";
import PriceChart, { RangePicker } from "../PriceChart";
import CurrencyPickerSheet from "../CurrencyPickerSheet";
import ActionSheetModal from "../components/ActionSheetModal";
import AddPortfolioModal from "../components/AddPortfolioModal";
import {
  ActionPlusIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CashGlyphIcon,
  CheckIcon,
  ChevronDownIcon,
  ClosedGlyphIcon,
  EmptyState,
  ListDivider,
  MoneyHero,
  StackIcon,
} from "../components/ds";
import { getPortfolioHistory } from "../api/portfolio";
import type { HistoryPoint, HistoryRange } from "../api/market";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { convert, fmtCcy, fmtShares } from "../lib/fx";

// Categorical allocation palette (design-system.html --c-1…--c-4), assigned
// by position, not meaning; cash is always brass.
const CAT_COLORS = ["var(--c-1)", "var(--c-2)", "var(--c-3)", "var(--c-4)"];
const CASH_COLOR = "var(--c-cash)";

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
    fxAsOf,
    loading,
    refreshMarket,
    hasActivity,
  } = usePortfolioData();

  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [portfolioSheetOpen, setPortfolioSheetOpen] = useState(false);
  const [addPortfolioOpen, setAddPortfolioOpen] = useState(false);

  const [range, setRange] = useState<HistoryRange>("1M");
  const [chartHistory, setChartHistory] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const chartRequestId = useRef(0);

  const openPositions = tickerAggregates.filter((t) => !t.closed);
  const openSymbols = openPositions.map((t) => t.symbol);
  const symbolsKey = openSymbols.join(",");

  useEffect(() => {
    if (openSymbols.length) refreshMarket(openSymbols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  useEffect(() => {
    if (!hasActivity && !loading.accounts) {
      setChartHistory([]);
      setHistoryLoading(false);
      return;
    }
    const id = ++chartRequestId.current;
    setHistoryLoading(true);
    getPortfolioHistory(range, displayCurrency)
      .then((points) => {
        if (chartRequestId.current === id) setChartHistory(points);
      })
      .catch(() => {
        if (chartRequestId.current === id) setChartHistory([]);
      })
      .finally(() => {
        if (chartRequestId.current === id) setHistoryLoading(false);
      });
    // activePortfolio?.id: switching portfolios must refetch even when the
    // other deps (range, hasActivity) happen to be identical.
  }, [range, displayCurrency, hasActivity, loading.accounts, activePortfolio?.id]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await refreshMarket(openSymbols);
    e.detail.complete();
  };

  const cashTotalDisplay = Object.entries(cashByCurrency).reduce(
    (sum, [currency, amount]) => sum + convert(amount, currency, displayCurrency, fxRates),
    0,
  );

  const positionsValueDisplay = openPositions.reduce((sum, t) => {
    const q = quotes[t.symbol];
    const price = q?.price ?? t.avgCost;
    const currency = q?.currency ?? t.currency;
    return sum + convert(price * t.totalShares, currency, displayCurrency, fxRates);
  }, 0);
  const total = cashTotalDisplay + positionsValueDisplay;

  const sortedHoldings = openPositions
    .map((t) => {
      const q = quotes[t.symbol];
      // Unrealized P/L on cost basis (quote converted to the position's
      // currency), not the day's change.
      let unrealizedPct: number | null = null;
      let unrealizedDisplay: number | null = null;
      let costBasisDisplay: number | null = null;
      if (q && t.costBasis > 1e-9) {
        const marketValueNative = convert(q.price, q.currency, t.currency, fxRates) * t.totalShares;
        unrealizedPct = ((marketValueNative - t.costBasis) / t.costBasis) * 100;
        unrealizedDisplay = convert(marketValueNative - t.costBasis, t.currency, displayCurrency, fxRates);
        costBasisDisplay = convert(t.costBasis, t.currency, displayCurrency, fxRates);
      }
      // Today's P/L, from the quote's own day-change rather than cost basis.
      let todayPct: number | null = null;
      let todayDisplay: number | null = null;
      if (q) {
        todayPct = q.changePercent;
        todayDisplay = convert(q.change * t.totalShares, q.currency, displayCurrency, fxRates);
      }
      return {
        symbol: t.symbol,
        name: q?.shortName,
        shares: t.totalShares,
        price: q?.price ?? t.avgCost,
        // Cost basis per share, not the live quote — the row-meta line
        // states what was paid, not what it's currently worth (that's
        // already implied by val above).
        avgCost: t.avgCost,
        currency: q?.currency ?? t.currency,
        unrealizedPct,
        unrealizedDisplay,
        costBasisDisplay,
        todayPct,
        todayDisplay,
        accountCount: t.perAccount.length,
      };
    })
    .sort(
      (a, b) =>
        convert(b.price * b.shares, b.currency, displayCurrency, fxRates) -
        convert(a.price * a.shares, a.currency, displayCurrency, fxRates),
    );

  // Portfolio-wide Today/Total, the same figures as each holding row's
  // stacked pnl lines, just summed across every open position — cash carries
  // no gain/loss of its own so it's excluded from both.
  let todaySumDisplay = 0;
  let hasTodayData = false;
  let unrealizedSumDisplay = 0;
  let costBasisSumDisplay = 0;
  for (const h of sortedHoldings) {
    if (h.todayDisplay != null) {
      todaySumDisplay += h.todayDisplay;
      hasTodayData = true;
    }
    if (h.unrealizedDisplay != null && h.costBasisDisplay != null) {
      unrealizedSumDisplay += h.unrealizedDisplay;
      costBasisSumDisplay += h.costBasisDisplay;
    }
  }
  const prevPositionsValueDisplay = positionsValueDisplay - todaySumDisplay;
  const todayPctAgg = prevPositionsValueDisplay > 1e-9 ? (todaySumDisplay / prevPositionsValueDisplay) * 100 : 0;
  const unrealizedPctAgg = costBasisSumDisplay > 1e-9 ? (unrealizedSumDisplay / costBasisSumDisplay) * 100 : 0;
  const todayGainAgg = todaySumDisplay >= 0;
  const unrealizedGainAgg = unrealizedSumDisplay >= 0;

  const cashCodes = Object.keys(cashByCurrency)
    .filter((c) => Math.abs(cashByCurrency[c]) > 1e-9)
    .sort();

  // Closed positions (every share sold) sit at the very bottom under their
  // own divider, dimmed, with realized P&L — DS .row.closed.
  const closedHoldings = tickerAggregates
    .filter((t) => t.closed && t.realizedCostBasis > 1e-9)
    .map((t) => {
      let lastSell = "";
      for (const tx of transactions) {
        if (tx.type === "sell" && tx.symbol === t.symbol && tx.date > lastSell) lastSell = tx.date;
      }
      return {
        symbol: t.symbol,
        closedOn: lastSell
          ? new Date(`${lastSell}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })
          : null,
        realizedPL: t.realizedPL,
        realizedPct: (t.realizedPL / t.realizedCostBasis) * 100,
        currency: t.currency,
      };
    });

  const allocSlices = [
    { key: "cash", label: "Cash", value: cashTotalDisplay, color: CASH_COLOR },
    ...sortedHoldings.map((h, i) => ({
      key: h.symbol,
      label: h.symbol,
      value: convert(h.price * h.shares, h.currency, displayCurrency, fxRates),
      color: CAT_COLORS[i % CAT_COLORS.length],
    })),
  ];
  const allocTotal = allocSlices.reduce((s, x) => s + x.value, 0) || 1;
  const holdingColor = new Map(allocSlices.map((s) => [s.key, s.color]));

  const quotesLoading = loading.market && openSymbols.length > 0 && Object.keys(quotes).length === 0;
  const isEmpty = !hasActivity && !loading.accounts;
  // Pre-fills Add Transaction's Account field with Onboarding's Investment
  // Account, since it's the only one that exists at this point.
  const firstInvestmentAccount = accounts.find((a) => a.type === "investment")?.name;

  return (
    <IonPage className="tab-root-page">
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{activePortfolio?.name ?? "Portfolio"}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">
              {/* DS .portfolio-switch — tapping the active portfolio's name
                  opens the switcher sheet. */}
              <button type="button" className="portfolio-switch" onClick={() => setPortfolioSheetOpen(true)}>
                {activePortfolio?.name ?? "Portfolio"}
                <ChevronDownIcon />
              </button>
            </IonTitle>
          </IonToolbar>
        </IonHeader>

        {isEmpty ? (
          <EmptyState
            icon={<StackIcon />}
            title="Nothing tracked yet"
            body="This portfolio is empty. Add your first buy, sell, deposit, or withdrawal to start tracking it."
            ctaLabel="Add Your First Transaction"
            onCta={() => history.push(`${tabBase}/add-transaction`, { account: firstInvestmentAccount })}
          />
        ) : (
          <>
            <div className="portfolio-summary">
              <div className="portfolio-summary-row">
                <IonNote className="eyebrow">Total Portfolio Value</IonNote>
                {quotesLoading && <IonSpinner name="crescent" className="inline-spinner" />}
              </div>
              <div className="hero-row">
                <MoneyHero value={total} currency={displayCurrency} />
                <button type="button" className="currency-chip" onClick={() => setCurrencySheetOpen(true)}>
                  {displayCurrency}
                  <ChevronDownIcon />
                </button>
              </div>
              {sortedHoldings.length > 0 && (
                <div className="gain-stack">
                  {hasTodayData && (
                    <p className={todayGainAgg ? "positive" : "negative"}>
                      <span className="pnl-label">Today:</span>
                      {todayGainAgg ? "+" : "−"}
                      {fmtCcy(Math.abs(todaySumDisplay), displayCurrency)} · {todayGainAgg ? "+" : "−"}
                      {Math.abs(todayPctAgg).toFixed(1)}%
                    </p>
                  )}
                  {costBasisSumDisplay > 1e-9 && (
                    <p className={unrealizedGainAgg ? "positive" : "negative"}>
                      <span className="pnl-label">Total:</span>
                      {unrealizedGainAgg ? "+" : "−"}
                      {fmtCcy(Math.abs(unrealizedSumDisplay), displayCurrency)} ·{" "}
                      {unrealizedGainAgg ? "+" : "−"}
                      {Math.abs(unrealizedPctAgg).toFixed(1)}%
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="chart-card">
              {historyLoading ? (
                <div className="chart-loading">
                  <IonSpinner name="crescent" />
                </div>
              ) : chartHistory.length > 1 ? (
                <PriceChart points={chartHistory} currency={displayCurrency} />
              ) : (
                <div className="chart-loading">
                  <IonNote>Not enough data for this range</IonNote>
                </div>
              )}
              <RangePicker range={range} onChange={setRange} />
            </div>

            <div className={`fx-note${fxAsOf ? "" : " fx-note--fallback"}`}>
              <span className="fx-dot" />
              {displayCurrency === "USD" ? (
                "Displaying in USD · no conversion needed"
              ) : (
                <>
                  1 USD = {(fxRates[displayCurrency] ?? 1).toFixed(4)} {displayCurrency} ·{" "}
                  {fxAsOf ? `live · ${fxAsOf}` : "fallback rate (live rate unavailable)"}
                  <button
                    type="button"
                    className="fx-refresh"
                    aria-label="Refresh rate"
                    onClick={() => refreshMarket(openSymbols)}
                  >
                    <IonIcon icon={refreshOutline} />
                  </button>
                </>
              )}
            </div>

            <div className="rows-head">
              <span>Allocation</span>
            </div>
            <div className="alloc-bar">
              {allocSlices.map((s) => (
                <span key={s.key} style={{ flex: (s.value / allocTotal) * 100, background: s.color }} />
              ))}
            </div>
            <div className="alloc-legend">
              {allocSlices.map((s) => (
                <div className="alloc-chip" key={s.key}>
                  <span className="alloc-dot" style={{ background: s.color }} />
                  <span className="alloc-lbl">{s.label}</span>
                  <span className="alloc-pct">{((s.value / allocTotal) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>

            <div className="rows-head">
              <span>Holdings</span>
              {sortedHoldings.length > 0 && (
                <span className="head-meta">
                  {sortedHoldings.length} position{sortedHoldings.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <IonList inset>
              <IonItem button detail={false} onClick={() => history.push(`${tabBase}/cash`)}>
                <IonAvatar slot="start" className="glyph glyph-cash">
                  <CashGlyphIcon />
                </IonAvatar>
                <IonLabel className="label-sym">
                  <h2>Cash</h2>
                  <p>
                    {cashCodes.length === 0
                      ? "No balances yet"
                      : `${cashCodes.length} currenc${cashCodes.length === 1 ? "y" : "ies"} · ${cashCodes.join(", ")}`}
                  </p>
                </IonLabel>
                <IonLabel slot="end">
                  <h2>{fmtCcy(cashTotalDisplay, displayCurrency)}</h2>
                </IonLabel>
              </IonItem>

              {sortedHoldings.map((h) => {
                const todayGain = h.todayPct != null && h.todayPct >= 0;
                const gain = h.unrealizedPct != null && h.unrealizedPct >= 0;
                return (
                  <IonItem key={h.symbol} button detail={false} onClick={() => history.push(`${tabBase}/asset/${h.symbol}`)}>
                    <IonAvatar slot="start" className="glyph glyph-stock">
                      <span className="glyph-dot" style={{ background: holdingColor.get(h.symbol) }} />
                    </IonAvatar>
                    <IonLabel className="label-sym">
                      <h2>{h.symbol}</h2>
                      <p>{h.name ?? `${fmtShares(h.shares)} sh`}</p>
                    </IonLabel>
                    <IonLabel slot="end">
                      <h2>{fmtCcy(h.price, h.currency)}</h2>
                      {/* DS .row .meta — cost basis (shares × avg cost), in
                          the holding's native currency: what was paid, not
                          what it's currently worth — the pnl lines below
                          already report how far that's moved. */}
                      <p className="row-meta">
                        {fmtCcy(h.shares * h.avgCost, h.currency)} ({fmtShares(h.shares)} x {fmtCcy(h.avgCost, h.currency)})
                      </p>
                      {h.todayPct != null && h.todayDisplay != null && (
                        <p className={todayGain ? "positive" : "negative"}>
                          <span className="pnl-label">Today:</span>
                          {todayGain ? "+" : "−"}
                          {fmtCcy(Math.abs(h.todayDisplay), displayCurrency)} ·{" "}
                          {todayGain ? "+" : "−"}
                          {Math.abs(h.todayPct).toFixed(1)}%
                        </p>
                      )}
                      {h.unrealizedPct != null && h.unrealizedDisplay != null && (
                        <p className={gain ? "positive" : "negative"}>
                          <span className="pnl-label">Total:</span>
                          {gain ? "+" : "−"}
                          {fmtCcy(Math.abs(h.unrealizedDisplay), displayCurrency)} ·{" "}
                          {gain ? "+" : "−"}
                          {Math.abs(h.unrealizedPct).toFixed(1)}%
                        </p>
                      )}
                    </IonLabel>
                  </IonItem>
                );
              })}
            </IonList>

            {closedHoldings.length > 0 && (
              <>
                <ListDivider label="Closed" />
                <IonList inset>
                  {closedHoldings.map((c) => {
                    const gain = c.realizedPL >= 0;
                    return (
                      <IonItem
                        key={c.symbol}
                        className="row-closed"
                        button
                        detail={false}
                        onClick={() => history.push(`${tabBase}/asset/${c.symbol}`)}
                      >
                        <IonAvatar slot="start" className="glyph glyph-closed">
                          <ClosedGlyphIcon />
                        </IonAvatar>
                        <IonLabel className="label-sym">
                          <h2>
                            {c.symbol} <span className="type-tag">Closed</span>
                          </h2>
                          {c.closedOn && <p>{c.closedOn}</p>}
                        </IonLabel>
                        <IonLabel slot="end">
                          <h2>Realized</h2>
                          <p className={gain ? "positive" : "negative"}>
                            {gain ? <ArrowUpIcon /> : <ArrowDownIcon />}
                            {gain ? "+" : "−"}
                            {fmtCcy(Math.abs(c.realizedPL), c.currency)} · {gain ? "+" : "−"}
                            {Math.abs(c.realizedPct).toFixed(1)}%
                          </p>
                        </IonLabel>
                      </IonItem>
                    );
                  })}
                </IonList>
              </>
            )}
          </>
        )}

        <CurrencyPickerSheet
          isOpen={currencySheetOpen}
          selected={displayCurrency}
          onClose={() => setCurrencySheetOpen(false)}
          onSelect={setDisplayCurrency}
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
