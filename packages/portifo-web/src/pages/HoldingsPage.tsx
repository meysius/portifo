import {
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
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefresherEventDetail } from "@ionic/react";
import { useHistory } from "react-router-dom";
import CurrencyPickerSheet from "../CurrencyPickerSheet";
import PriceChart, { RangePicker } from "../PriceChart";
import ActionSheetModal from "../components/ActionSheetModal";
import AddPortfolioModal from "../components/AddPortfolioModal";
import {
  ActionPlusIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EmptyState,
  ListDivider,
  MoneyHero,
  PlusIcon,
  StackIcon,
} from "../components/ds";
import { getPortfolioHistory } from "../api/portfolio";
import type { HistoryPoint, HistoryRange } from "../api/market";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { convert, fmtCcy, fmtShares } from "../lib/fx";
// TEMPORARY — see lib/chartDiagnostic.ts; remove once the hero/chart gap is explained.
import { logChartDiagnostic } from "../lib/chartDiagnostic";

// Past this many movers the Today block truncates to a "+n more" tail rather
// than scrolling, so the section has a fixed ceiling of about 130pt.
const MAX_MOVERS = 6;

// Allocation slices, assigned by POSITION in the sorted list and never by asset
// type (guidelines § Weight is coloured in exactly one place). --cat-cash is the
// one fixed assignment. The ramp recycles at the 5th slice on purpose: every
// slice is paired with its ticker and share in the legend directly under the
// bar, so position and label disambiguate — more hues would not separate.
const CAT_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)"];
const CASH_COLOR = "var(--cat-cash)";

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
    refreshAccounts,
    refreshTransactions,
    refreshMarket,
    hasActivity,
  } = usePortfolioData();

  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [portfolioSheetOpen, setPortfolioSheetOpen] = useState(false);
  const [addPortfolioOpen, setAddPortfolioOpen] = useState(false);

  const [range, setRange] = useState<HistoryRange>("1M");
  const [chartHistory, setChartHistory] = useState<HistoryPoint[]>([]);
  const [chartEstimatedTickers, setChartEstimatedTickers] = useState<string[]>([]);
  const [chartEstimatedCurrencies, setChartEstimatedCurrencies] = useState<string[]>([]);
  const [chartReconciledCash, setChartReconciledCash] = useState<{ currency: string; amount: number }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const chartRequestId = useRef(0);

  const openPositions = tickerAggregates.filter((t) => !t.closed);
  const openSymbols = openPositions.map((t) => t.symbol);
  const symbolsKey = openSymbols.join(",");

  useEffect(() => {
    if (openSymbols.length) refreshMarket(openSymbols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  // `silent` skips the chart's spinner: on pull-to-refresh the refresher's own
  // spinner is already showing, and blanking the curve mid-pull reads as a
  // glitch. The request-id guard makes the last request win either way.
  const loadHistory = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const id = ++chartRequestId.current;
      if (!silent) setHistoryLoading(true);
      try {
        const history = await getPortfolioHistory(range, displayCurrency);
        if (chartRequestId.current === id) {
          setChartHistory(history.points);
          setChartEstimatedTickers(history.estimatedTickers);
          setChartEstimatedCurrencies(history.estimatedCurrencies);
          setChartReconciledCash(history.reconciledCash ?? []);
        }
      } catch {
        if (chartRequestId.current === id) {
          setChartHistory([]);
          setChartEstimatedTickers([]);
          setChartEstimatedCurrencies([]);
          setChartReconciledCash([]);
        }
      } finally {
        if (chartRequestId.current === id && !silent) setHistoryLoading(false);
      }
    },
    [range, displayCurrency],
  );

  useEffect(() => {
    if (!hasActivity && !loading.accounts) {
      setChartHistory([]);
      setHistoryLoading(false);
      return;
    }
    loadHistory();
    // activePortfolio?.id: switching portfolios must refetch even when the
    // other deps (range, hasActivity) happen to be identical.
  }, [loadHistory, hasActivity, loading.accounts, activePortfolio?.id]);

  // Pull-to-refresh refetches everything this screen shows, not just quotes:
  // the ledger (another member may have added a transaction), the balances the
  // Cash row and total are built from, live prices/fx, and the chart series.
  // Silent so the rows and the curve stay put under the refresher's own spinner.
  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    try {
      await Promise.all([
        refreshTransactions({ silent: true }),
        refreshAccounts({ silent: true }),
        refreshMarket(openSymbols),
        loadHistory({ silent: true }),
      ]);
    } finally {
      e.detail.complete();
    }
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
        // perAccount also carries accounts that have sold out of this ticker
        // (they still hold realized P&L) — an open row counts only the accounts
        // actually holding shares.
        accountCount: t.perAccount.filter((pa) => pa.shares > 0).length,
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

  // Allocation — the partition bar and its legend, which is the ONE place a
  // holding's share is stated. Cash leads (at 16% it is the second-largest line
  // here), then holdings by value, and the legend repeats that order exactly:
  // the reader matches slice to label by position first and hue second, which
  // is what survives the palette recycling at the 5th slice.
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

  // Today's movers — the block standing where the value chart used to. Sorted
  // by the SIZE of the contribution regardless of direction, so the row that
  // moved the total most is first whichever way it went, and scaled to that
  // largest mover. Cash never appears: it has nothing to contribute.
  const movers = sortedHoldings
    .filter((h) => h.todayDisplay != null && h.todayPct != null)
    .map((h) => ({ symbol: h.symbol, amount: h.todayDisplay as number, pct: h.todayPct as number }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const moversShown = movers.slice(0, MAX_MOVERS);
  const moversRest = movers.slice(MAX_MOVERS);
  const moversRestSum = moversRest.reduce((s, m) => s + m.amount, 0);
  const moverScale = Math.max(...movers.map((m) => Math.abs(m.amount)), 0);

  // TEMPORARY — remove with lib/chartDiagnostic.ts once the hero/chart gap is
  // explained. Prod runs on a VM with no shell access from here, so the browser
  // console is the only way to read its numbers.
  useEffect(() => {
    if (historyLoading || chartHistory.length === 0 || sortedHoldings.length === 0) return;
    logChartDiagnostic({
      portfolioName: activePortfolio?.name,
      portfolioId: activePortfolio?.id,
      displayCurrency,
      range,
      cashByCurrency,
      fxRates,
      fxAsOf,
      positions: sortedHoldings.map((h) => ({
        symbol: h.symbol,
        shares: h.shares,
        price: h.price,
        currency: h.currency,
      })),
      points: chartHistory,
      estimatedTickers: chartEstimatedTickers,
      estimatedCurrencies: chartEstimatedCurrencies,
      reconciledCash: chartReconciledCash,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading, chartHistory, displayCurrency, range, activePortfolio?.id, quotes, cashByCurrency]);

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
            {/* Trailing action per the header table: Portfolio adds a
                transaction. Lives in the condense header, so it rides the
                large-title row and scrolls away with it. */}
            <button
              type="button"
              slot="end"
              className="add-fab"
              aria-label="Add transaction"
              onClick={() => history.push(`${tabBase}/add-transaction`, { account: firstInvestmentAccount })}
            >
              <PlusIcon />
            </button>
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
              {/* Total only. Today's figure lives on the Today divider below,
                  so the screen doesn't say "Today" twice 40pt apart. */}
              {sortedHoldings.length > 0 && costBasisSumDisplay > 1e-9 && (
                <div className="gain-stack">
                  <p className={unrealizedGainAgg ? "positive" : "negative"}>
                    <span className="pnl-label">Total:</span>
                    {unrealizedGainAgg ? "+" : "−"}
                    {fmtCcy(Math.abs(unrealizedSumDisplay), displayCurrency)} ·{" "}
                    {unrealizedGainAgg ? "+" : "−"}
                    {Math.abs(unrealizedPctAgg).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>

            {/* Portfolio value over the selected range, in the display
                currency. Full-bleed block carrying its own gutter, so its edges
                line up with the text column above and below it. */}
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
              {/* The curve is a reconstruction from the ledger, so it can only
                  be as good as the price history behind it. When something had
                  to be estimated the chart says which — the alternative, and
                  what this replaced, was dropping it and drawing a total below
                  the hero with nothing to explain the gap. */}
              {chartEstimatedTickers.length + chartEstimatedCurrencies.length > 0 && (
                <p className="chart-estimate-note">
                  Estimated for {[...chartEstimatedTickers, ...chartEstimatedCurrencies].join(", ")} — no price history
                </p>
              )}
            </div>

            {/* Today's movers. Not a second telling of the curve above: that is
                the total over the selected range, this is the current day broken
                down by holding — which one moved the total, and by how much,
                which the curve cannot say at any range. */}
            {hasTodayData && (
              <>
                <ListDivider
                  label="Today"
                  meta={`${todayGainAgg ? "+" : "−"}${fmtCcy(Math.abs(todaySumDisplay), displayCurrency)} · ${
                    todayGainAgg ? "+" : "−"
                  }${Math.abs(todayPctAgg).toFixed(2)}%`}
                  metaTone={todayGainAgg ? "gain" : "loss"}
                />
                <div className="movers">
                  {moversShown.map((m) => {
                    const gain = m.amount > 0;
                    // Sign is the SIDE of the baseline, not the colour:
                    // --gain and --loss separate at only ΔE 6.5 under
                    // simulated deuteranopia. Each arm is half the plot, so a
                    // full-scale bar is 50% of its width.
                    const flat = Math.abs(m.amount) < 0.005;
                    const width = moverScale > 1e-9 ? (Math.abs(m.amount) / moverScale) * 50 : 0;
                    return (
                      <div className="mv-row" key={m.symbol}>
                        <span className="mv-t">{m.symbol}</span>
                        <span className="mv-plot">
                          <i
                            className={flat ? "flat" : gain ? "pos" : "neg"}
                            style={flat ? undefined : { width: `${width}%` }}
                          />
                        </span>
                        <span className={`mv-v${flat ? "" : gain ? " gain" : " loss"}`}>
                          {flat ? (
                            "unchanged"
                          ) : (
                            <>
                              {gain ? "+" : "−"}
                              {fmtCcy(Math.abs(m.amount), displayCurrency)} ·{" "}
                              <span className="pc">
                                {gain ? "+" : "−"}
                                {Math.abs(m.pct).toFixed(2)}%
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {moversRest.length > 0 && (
                  <div className="mv-tail">
                    +{moversRest.length} more · {moversRestSum >= 0 ? "+" : "−"}
                    {fmtCcy(Math.abs(moversRestSum), displayCurrency)}
                  </div>
                )}
              </>
            )}

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

            {/* Bar and legend ship together and never apart — the legend is
                where the share is read, and it is what makes --cat-* legal
                (guidelines § Weight is coloured in exactly one place). */}
            <ListDivider label="Allocation" />
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

            <ListDivider
              label="Holdings"
              meta={
                sortedHoldings.length > 0
                  ? `${sortedHoldings.length} position${sortedHoldings.length === 1 ? "" : "s"}`
                  : undefined
              }
            />
            <IonList inset>
              <IonItem
                className="row-hold"
                button
                detail={false}
                onClick={() => history.push(`${tabBase}/cash`)}
              >
                {/* No share on the row in any form — no leading cell, no bar,
                    no chip. The legend a section above states it once, and the
                    leading slot those marks occupied is why this list started
                    50pt in from the gutter while every other list in the app
                    starts at it. */}
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
                <span slot="end" className="row-chevron" aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </IonItem>

              {sortedHoldings.map((h) => {
                const gain = h.unrealizedPct != null && h.unrealizedPct >= 0;
                return (
                  <IonItem
                    key={h.symbol}
                    className="row-hold"
                    button
                    detail={false}
                    onClick={() => history.push(`${tabBase}/asset/${h.symbol}`)}
                  >
                    <IonLabel className="label-sym">
                      <h2>{h.symbol}</h2>
                      <p>{h.name ?? `${fmtShares(h.shares)} sh`}</p>
                    </IonLabel>
                    <IonLabel slot="end">
                      <h2>{fmtCcy(h.price * h.shares, h.currency)}</h2>
                      {/* Total only — Today moved out of the rows and into the
                          movers block above, where it is ranked and scaled.
                          Keeping both would print every figure twice, and it is
                          what shortened these rows from 72pt to 55pt. The label
                          is the neutral tag read first, and only the figures
                          carry gain/loss; the amount is in displayCurrency so
                          the column adds up across a mixed-currency list. */}
                      {h.unrealizedPct != null && h.unrealizedDisplay != null && (
                        <p className={gain ? "positive" : "negative"}>
                          <span className="pnl-label">Total:</span>
                          {gain ? "+" : "−"}
                          {fmtCcy(Math.abs(h.unrealizedDisplay), displayCurrency)} · {gain ? "+" : "−"}
                          {Math.abs(h.unrealizedPct).toFixed(1)}%
                        </p>
                      )}
                    </IonLabel>
                    <span slot="end" className="row-chevron" aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
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
                        {/* A closed position has no share, so it is absent from
                            the allocation bar. Its "Closed" chip is the only
                            thing in this slot on any row, and the ticker needs
                            no spacer to line up with the open rows above —
                            nothing leads them. */}
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
