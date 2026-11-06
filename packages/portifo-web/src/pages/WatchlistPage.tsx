import { IonContent, IonPage, IonRefresher, IonRefresherContent, useIonViewWillEnter } from "@ionic/react";
import type { RefresherEventDetail } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useHistory } from "react-router-dom";
import { isOn } from "../api/alerts";
import { EXTENDED_LABEL, getSparks, searchSymbols } from "../api/market";
import type { Quote, Spark, SymbolResult } from "../api/market";
import StickyTitleBar from "../components/StickyTitleBar";
import WatchSpark from "../components/WatchSpark";
import { useAlerts } from "../context/AlertsContext";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useWatchlist } from "../context/WatchlistContext";
import { EXTENDED_HOURS_KEY, useChartPref } from "../lib/chartPrefs";
import { fmtCcy, fmtSignedCcy, fmtSignedPct } from "../lib/fx";
import { useHeadingScrolledAway } from "../lib/useHeadingScrolledAway";

// The Watchlist tab: symbols you follow, owned or not. The search field sits
// under the heading; while it holds a query, its results take the list's
// place and tapping one adds it (or, once added, takes it off again). A row on
// the list reads across: the symbol and company, the day's line (WatchSpark),
// then the price and today's move, plus the pre-market, after-hours or
// overnight price outside regular hours. The lines sit in one column, so the
// list reads as a set of small charts. A row pushes the symbol's own page,
// with its chart and price alerts. A bell marks a symbol with an alert on.
//
// The list belongs to the signed-in user, not the active portfolio, and every
// price stays in the symbol's own currency, with its code beside it.

const SEARCH_DEBOUNCE_MS = 250;
// The lines are fetched again this often while any listed market trades.
const SPARK_REFRESH_MS = 5 * 60_000;
const TRADING_STATES = new Set(["REGULAR", "PRE", "POST"]);

// The lines last fetched, with extended hours and without, so a remount
// (switching tabs remounts the stack) draws them at once.
const sparkCache = new Map<boolean, Record<string, Spark>>();

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
const ICONS = {
  search: icon(
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>,
    16,
  ),
  plus: icon(<path d="M12 5v14M5 12h14" />),
  check: icon(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  bell: icon(
    <>
      <path d="M18 9a6 6 0 1 0-12 0c0 5.5-2.5 7.5-2.5 7.5h17S18 14.5 18 9Z" />
      <path d="M10.3 20a2 2 0 0 0 3.4 0" />
    </>,
    12,
  ),
  eye: icon(
    <>
      <path d="M2.5 12C4.5 8 8 5.5 12 5.5s7.5 2.5 9.5 6.5c-2 4-5.5 6.5-9.5 6.5S4.5 16 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
};

// Coloured by the percentage as shown: a move that rounds to 0.0% is no move.
const tone = (changePercent: number) => {
  const pct = Math.round(changePercent * 10) / 10;
  return pct > 0 ? "positive" : pct < 0 ? "negative" : "";
};
const today = (q: Quote) => `${fmtSignedCcy(q.change, q.currency)} · ${fmtSignedPct(q.changePercent)}`;
const outsideHours = (q: Quote) =>
  q.extended &&
  `${EXTENDED_LABEL[q.extended.session]} ${fmtCcy(q.extended.price, q.currency)}, ${fmtSignedPct(q.extended.changePercent)}`;

function WatchlistPage() {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const { quotes, loading, refreshMarket } = usePortfolioData();
  const { symbols, loadFailed, names, reload, add, remove } = useWatchlist();
  const { alerts, reload: reloadAlerts } = useAlerts();
  const { headingRef, away, onIonScroll } = useHeadingScrolledAway<HTMLDivElement>();
  // The charts' Extended hours setting: the lines follow it too.
  const [extendedOn] = useChartPref(EXTENDED_HOURS_KEY);

  // A newly listed symbol needs its quote; the ones already cached are
  // refreshed each time the page is entered (switching to the tab remounts
  // it; Back from a symbol re-enters it) and on a pull.
  const symbolsKey = symbols?.join(",") ?? "";
  useEffect(() => {
    const missing = (symbols ?? []).filter((s) => !quotes[s]);
    if (missing.length) refreshMarket(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  // Each day's line: fetched with the list, again on every visit and pull,
  // and every five minutes while a listed market trades. Yahoo has no bars
  // overnight, so then only the streamed trade moves a line.
  const [sparks, setSparks] = useState<Record<string, Spark>>(() => sparkCache.get(extendedOn) ?? {});
  const [sparkFetches, setSparkFetches] = useState(0);
  useEffect(() => {
    setSparks(sparkCache.get(extendedOn) ?? {});
  }, [extendedOn]);
  useEffect(() => {
    if (!symbols?.length) return;
    let live = true;
    getSparks(symbols, extendedOn)
      .then((next) => {
        const merged = { ...sparkCache.get(extendedOn), ...next };
        sparkCache.set(extendedOn, merged);
        if (live) setSparks(merged);
      })
      // Without them the rows draw without lines.
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, extendedOn, sparkFetches]);
  const trading = (symbols ?? []).some((s) => TRADING_STATES.has(quotes[s]?.marketState ?? ""));
  useEffect(() => {
    if (!trading) return;
    const id = setInterval(() => {
      if (!document.hidden) setSparkFetches((n) => n + 1);
    }, SPARK_REFRESH_MS);
    return () => clearInterval(id);
  }, [trading]);

  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;
  // The first entry is the mount, which has just fetched everything.
  const entered = useRef(false);
  useIonViewWillEnter(() => {
    const list = symbolsRef.current;
    if (list?.length) refreshMarket(list);
    reloadAlerts();
    if (entered.current) setSparkFetches((n) => n + 1);
    entered.current = true;
  }, [refreshMarket, reloadAlerts]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    try {
      const [list] = await Promise.all([reload(), reloadAlerts()]);
      if (list?.length) await refreshMarket(list);
      setSparkFetches((n) => n + 1);
    } finally {
      e.detail.complete();
    }
  };

  // ----- search -----
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const id = ++requestId.current;
    setSearchFailed(false);
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchSymbols(trimmed);
        if (requestId.current === id) setResults(found);
      } catch {
        if (requestId.current === id) setSearchFailed(true);
      } finally {
        if (requestId.current === id) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const searchMode = query.trim() !== "";
  const cancelSearch = () => {
    setQuery("");
    inputRef.current?.blur();
  };

  const watching = new Set(symbols ?? []);
  const alerted = new Set(alerts?.filter(isOn).map((a) => a.symbol));
  const toggle = (r: SymbolResult) => (watching.has(r.symbol) ? remove(r.symbol) : add(r.symbol, r.name));
  const openSymbol = (symbol: string) => history.push(`${tabBase}/symbol/${encodeURIComponent(symbol)}`);

  const listView =
    symbols === null ? (
      loadFailed && <p className="wl-status">Your watchlist couldn’t be loaded. Pull down to try again.</p>
    ) : symbols.length === 0 ? (
      <section className="wl-empty">
        <div className="wl-empty-symbol">{ICONS.eye}</div>
        <h2>Keep an eye on the market.</h2>
        <p>
          Search for a ticker or company above.
          <br />
          Its price and today’s move will show up here.
        </p>
        <button type="button" className="ds-action" onClick={() => inputRef.current?.focus()}>
          Find a symbol
        </button>
      </section>
    ) : (
      <>
        <div className="wl-list wl-board">
          {symbols.map((symbol) => {
            const q = quotes[symbol];
            const name = q?.shortName ?? names[symbol];
            return (
              <button
                key={symbol}
                type="button"
                className="wl-row"
                aria-label={[
                  symbol,
                  name,
                  q && `${q.currency} ${fmtCcy(q.price, q.currency)}`,
                  q && `${today(q)} today`,
                  q && outsideHours(q),
                  alerted.has(symbol) && "price alert on",
                ]
                  .filter(Boolean)
                  .join(", ")}
                onClick={() => openSymbol(symbol)}
              >
                <span className="wl-symbol">
                  {symbol}
                  {alerted.has(symbol) && <span className="wl-alert-mark">{ICONS.bell}</span>}
                </span>
                {name && <span className="wl-meta">{name}</span>}
                <WatchSpark spark={sparks[symbol]} quote={q} extended={extendedOn} />
                {q ? (
                  <>
                    <span className="wl-price">
                      <span className="wl-ccy">{q.currency}</span>
                      <span className="money">{fmtCcy(q.price, q.currency)}</span>
                    </span>
                    <span className={`wl-move money ${tone(q.changePercent)}`}>{fmtSignedPct(q.changePercent)}</span>
                    {q.extended && (
                      <span className="wl-extended">
                        {EXTENDED_LABEL[q.extended.session]}
                        <span className="money">{fmtCcy(q.extended.price, q.currency)}</span>
                        <span className={`money ${tone(q.extended.changePercent)}`}>
                          {fmtSignedPct(q.extended.changePercent)}
                        </span>
                      </span>
                    )}
                  </>
                ) : (
                  !loading.market && <span className="wl-no-quote">No price</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="wl-footer">
          The dashed line is the previous close
          <br />
          Prices in each symbol’s own currency
          <br />
          The same watchlist in every portfolio
        </p>
      </>
    );

  const searchView = (
    <>
      {results.length > 0 && (
        <div className="wl-list" role="group" aria-label="Search results">
          {results.map((r) => {
            const on = watching.has(r.symbol);
            return (
              <button
                key={r.symbol}
                type="button"
                className="wl-row"
                aria-pressed={on}
                aria-label={`${on ? "Remove" : "Add"} ${r.symbol}${r.name ? `, ${r.name},` : ""} ${on ? "from" : "to"} watchlist`}
                onClick={() => toggle(r)}
              >
                <span className="wl-identity">
                  <span className="wl-symbol">{r.symbol}</span>
                  <span className="wl-meta">{[r.name, r.exchange].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={`wl-toggle${on ? " on" : ""}`}>{on ? ICONS.check : ICONS.plus}</span>
              </button>
            );
          })}
        </div>
      )}
      <p className="wl-status" role="status">
        {searchFailed ? (
          "Search isn’t available right now. Try again in a moment."
        ) : results.length > 0 ? (
          ""
        ) : searching ? (
          "Searching…"
        ) : (
          <>
            No symbols found.
            <br />
            Try a ticker or company name.
          </>
        )}
      </p>
    </>
  );

  return (
    <IonPage className="tab-root-page ds-screen wl-page">
      <StickyTitleBar title="Watchlist" shown={away} />
      <IonContent scrollEvents onIonScroll={onIonScroll}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="wl-heading" ref={headingRef}>
          <h1>Watchlist</h1>
        </div>

        <div className="wl-search">
          <div className="tl-search-field">
            {ICONS.search}
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              aria-label="Search symbols"
              placeholder="Search a ticker or company"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {searchMode && (
            <button type="button" className="wl-cancel" onClick={cancelSearch}>
              Cancel
            </button>
          )}
        </div>

        {searchMode ? searchView : listView}
      </IonContent>
    </IonPage>
  );
}

export default WatchlistPage;
