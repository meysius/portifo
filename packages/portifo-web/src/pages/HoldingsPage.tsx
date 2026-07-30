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
import { useEffect, useState } from "react";
import type { RefresherEventDetail } from "@ionic/react";
import { useHistory } from "react-router-dom";
import CurrencyPickerSheet from "../CurrencyPickerSheet";
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
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { convert, fmtCcy, fmtShares } from "../lib/fx";

// Past this many movers the Today block truncates to a "+n more" tail rather
// than scrolling, so the section has a fixed ceiling of about 130pt.
const MAX_MOVERS = 6;

// Integer weights that sum to 100: round half-up, then give the largest holding
// the remainder. Rounding each independently leaves the column reading 99 or
// 101, which is the kind of thing a reader notices and cannot explain.
function integerWeights(values: number[], total: number): number[] {
  if (total <= 1e-9) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const out = exact.map((p) => Math.round(p));
  const drift = 100 - out.reduce((s, p) => s + p, 0);
  if (drift !== 0 && out.length) {
    let biggest = 0;
    for (let i = 1; i < exact.length; i++) if (exact[i] > exact[biggest]) biggest = i;
    out[biggest] += drift;
  }
  return out;
}

// A holding under 0.5% rounds to 0, and "0%" next to a real balance reads as a
// bug rather than as a small position.
function fmtWeight(pct: number, exact: number) {
  if (pct <= 0 && exact > 0) return "<1%";
  return `${pct}%`;
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

  const openPositions = tickerAggregates.filter((t) => !t.closed);
  const openSymbols = openPositions.map((t) => t.symbol);
  const symbolsKey = openSymbols.join(",");

  useEffect(() => {
    if (openSymbols.length) refreshMarket(openSymbols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  // Pull-to-refresh refetches everything this screen shows, not just quotes:
  // the ledger (another member may have added a transaction), the balances the
  // Cash row and total are built from, and live prices/fx. Silent so the rows
  // stay put under the refresher's own spinner.
  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    try {
      await Promise.all([
        refreshTransactions({ silent: true }),
        refreshAccounts({ silent: true }),
        refreshMarket(openSymbols),
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

  // Each row's share of the portfolio, in the leading cell. This is what
  // replaced the allocation bar and its colour key: the figure needs no legend,
  // survives any number of holdings, and cannot collide with itself. Cash is in
  // the ranking because at 16% it is the second-largest line here.
  const weightRows = [
    { key: "cash", value: cashTotalDisplay },
    ...sortedHoldings.map((h) => ({
      key: h.symbol,
      value: convert(h.price * h.shares, h.currency, displayCurrency, fxRates),
    })),
  ];
  const weightTotal = weightRows.reduce((s, x) => s + x.value, 0);
  const weightInts = integerWeights(
    weightRows.map((r) => r.value),
    weightTotal,
  );
  const weightOf = new Map(
    weightRows.map((r, i) => [
      r.key,
      { pct: weightInts[i], exact: weightTotal > 1e-9 ? (r.value / weightTotal) * 100 : 0 },
    ]),
  );

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

            {/* Today's movers — what the value chart used to occupy. The chart
                restated the hero's own figure; this answers the question the
                hero raises and the curve never could: which holding moved the
                total, and by how much. */}
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

            <ListDivider
              label="Holdings"
              meta={
                sortedHoldings.length > 0
                  ? `${sortedHoldings.length} position${sortedHoldings.length === 1 ? "" : "s"} · % of total`
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
                {/* The share is a chip on the ticker line and nothing else — no
                    leading cell, no bar. Both said the same number, and the
                    leading slot they occupied is why this list started 50pt in
                    from the gutter while every other list in the app starts at
                    it. */}
                <IonLabel className="label-sym">
                  <h2>
                    Cash{" "}
                    <span className="w-tag">
                      {fmtWeight(weightOf.get("cash")?.pct ?? 0, weightOf.get("cash")?.exact ?? 0)}
                    </span>
                  </h2>
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
                const w = weightOf.get(h.symbol);
                return (
                  <IonItem
                    key={h.symbol}
                    className="row-hold"
                    button
                    detail={false}
                    onClick={() => history.push(`${tabBase}/asset/${h.symbol}`)}
                  >
                    <IonLabel className="label-sym">
                      <h2>
                        {h.symbol} <span className="w-tag">{fmtWeight(w?.pct ?? 0, w?.exact ?? 0)}</span>
                      </h2>
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
                        {/* No .w-tag: a closed position has no share. Its
                            "Closed" chip takes the same slot on the ticker line
                            in the same form, and the ticker needs no spacer to
                            line up with the open rows — nothing leads them. */}
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
