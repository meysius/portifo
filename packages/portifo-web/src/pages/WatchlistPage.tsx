import { IonContent, IonPage, IonRefresher, IonRefresherContent, useIonViewWillEnter } from "@ionic/react";
import type { RefresherEventDetail } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useHistory } from "react-router-dom";
import { searchSymbols } from "../api/market";
import type { Quote, SymbolResult } from "../api/market";
import StickyTitleBar from "../components/StickyTitleBar";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useWatchlist } from "../context/WatchlistContext";
import { fmtCcy, fmtSignedCcy, fmtSignedPct } from "../lib/fx";
import { useHeadingScrolledAway } from "../lib/useHeadingScrolledAway";

// The Watchlist tab: symbols you follow, owned or not. The search field sits
// under the heading; while it holds a query, its results take the list's
// place and tapping one adds it (or, once added, takes it off again). A row on
// the list shows the latest price and today's move, and pushes the symbol's
// own page, with its chart.
//
// The list belongs to the signed-in user, not the active portfolio, and every
// price stays in the symbol's own currency, with its code beside it.

const SEARCH_DEBOUNCE_MS = 250;

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
  eye: icon(
    <>
      <path d="M2.5 12C4.5 8 8 5.5 12 5.5s7.5 2.5 9.5 6.5c-2 4-5.5 6.5-9.5 6.5S4.5 16 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
};

// Coloured by the percentage as shown: a move that rounds to 0.0% is no move.
const tone = (q: Quote) => {
  const pct = Math.round(q.changePercent * 10) / 10;
  return pct > 0 ? "positive" : pct < 0 ? "negative" : "";
};
const today = (q: Quote) => `${fmtSignedCcy(q.change, q.currency)} · ${fmtSignedPct(q.changePercent)}`;

function WatchlistPage() {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const { quotes, loading, refreshMarket } = usePortfolioData();
  const { symbols, loadFailed, names, reload, add, remove } = useWatchlist();
  const { headingRef, away, onIonScroll } = useHeadingScrolledAway<HTMLDivElement>();

  // A newly listed symbol needs its quote; the ones already cached are
  // refreshed each time the page is entered (switching to the tab remounts
  // it; Back from a symbol re-enters it) and on a pull.
  const symbolsKey = symbols?.join(",") ?? "";
  useEffect(() => {
    const missing = (symbols ?? []).filter((s) => !quotes[s]);
    if (missing.length) refreshMarket(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;
  useIonViewWillEnter(() => {
    const list = symbolsRef.current;
    if (list?.length) refreshMarket(list);
  }, [refreshMarket]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    try {
      const list = await reload();
      if (list?.length) await refreshMarket(list);
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
        <div className="wl-list">
          <div className="wl-caption">
            <span>Symbol / company</span>
            <span>Price / today</span>
          </div>
          {symbols.map((symbol) => {
            const q = quotes[symbol];
            const name = q?.shortName ?? names[symbol];
            return (
              <button
                key={symbol}
                type="button"
                className="wl-row"
                aria-label={[symbol, name, q && `${q.currency} ${fmtCcy(q.price, q.currency)}`, q && `${today(q)} today`]
                  .filter(Boolean)
                  .join(", ")}
                onClick={() => openSymbol(symbol)}
              >
                <span className="wl-identity">
                  <span className="wl-symbol">{symbol}</span>
                  {name && <span className="wl-meta">{name}</span>}
                </span>
                {q ? (
                  <span className="wl-end">
                    <span className="wl-price">
                      <span className="wl-ccy">{q.currency}</span>
                      <span className="money">{fmtCcy(q.price, q.currency)}</span>
                    </span>
                    <span className={`wl-move money ${tone(q)}`}>{today(q)}</span>
                  </span>
                ) : (
                  !loading.market && <span className="wl-no-quote">No price</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="wl-footer">
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
