import {
  IonContent,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  useIonViewWillEnter,
} from "@ionic/react";
import type { RefresherEventDetail } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { flushSync } from "react-dom";
import { useHistory } from "react-router-dom";
import { isOn } from "../api/alerts";
import { EXTENDED_LABEL, searchSymbols } from "../api/market";
import type { ExtendedHours, Quote, SymbolResult } from "../api/market";
import StickyTitleBar from "../components/StickyTitleBar";
import { useAlerts } from "../context/AlertsContext";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useWatchlist } from "../context/WatchlistContext";
import { fmtCcy, fmtSignedCcy } from "../lib/fx";
import { useHeadingScrolledAway } from "../lib/useHeadingScrolledAway";

// The Watchlist tab: symbols you follow, owned or not. Symbols are added as
// transactions are: the heading's + opens a search field under it, and its
// results take the list's place while it holds a query. Tapping a result adds
// it (or, once added, takes it off again); Cancel closes the search. A row is
// taken off the list by swiping it left to a Remove action, or all the way
// across.
//
// A row is the symbol over its company, then at the right its latest price,
// a bar of its move and the move itself. Outside regular hours, once the
// symbol has traded since the close, the price is that trade's, marked by its
// session's glyph (a sun before the open, a moon after the close, a moon and
// a star overnight), and the move is the one since the close. A row pushes
// the symbol's own page, with its chart and price alerts. A bell marks a
// symbol with an alert on.
//
// The bars share one scale, the list's biggest move filling its half, so the
// rows compare at a glance; under 1% they never fill.
//
// The list belongs to the signed-in user, not the active portfolio, and every
// price stays in the symbol's own currency; one that isn't US dollars says so.

const SEARCH_DEBOUNCE_MS = 250;
// Half the bar's width stands for the list's biggest move, or 1%, whichever is more.
const BAR_FLOOR_PCT = 1;
const BAR_HALF = 26;
const BAR_MIN = 6; // a move that shows is at least a dot

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

// The session a row's price was struck in, when it isn't the regular one.
const SESSION_ICONS: Record<ExtendedHours["session"], ReactNode> = {
  pre: icon(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>,
    14,
  ),
  post: icon(<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />, 14),
  overnight: icon(
    <>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
      <path d="M17 3v4M15 5h4" />
    </>,
    14,
  ),
};

// The row's price and move: the latest trade outside regular hours and its
// move since the close, else the regular price and today's move.
const latest = (q: Quote) =>
  q.extended
    ? {
        price: q.extended.price,
        pct: q.extended.changePercent,
        session: q.extended.session,
      }
    : { price: q.price, pct: q.changePercent, session: undefined };

// To two places, as a watchlist reads small moves, with a true minus.
const fmtMove = (pct: number) => {
  const s = Math.abs(pct).toFixed(2);
  return s === "0.00" ? "0.00%" : `${pct < 0 ? "−" : "+"}${s}%`;
};
// Coloured by the percentage as shown: a move that rounds to 0.00% is no move.
const tone = (pct: number) => {
  const shown = Math.round(pct * 100) / 100;
  return shown > 0 ? "positive" : shown < 0 ? "negative" : "";
};
const fmtPrice = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(n) < 1 ? 4 : 2,
  });
const describe = (q: Quote) => {
  const { price, pct, session } = latest(q);
  const at = `${fmtCcy(price, q.currency)} ${q.currency}`;
  return session
    ? `${EXTENDED_LABEL[session]} ${at}, ${fmtMove(pct)} since the close`
    : `${at}, ${fmtSignedCcy(q.change, q.currency)} · ${fmtMove(pct)} today`;
};

// A track with a tick at its centre; the move grows from the tick, right for
// a gain and left for a loss.
function MoveBar({ pct, scale }: { pct: number; scale: number }) {
  const t = tone(pct);
  if (!t) return <span className="wl-bar" aria-hidden="true" />;
  const w = Math.max(BAR_MIN, Math.min(1, Math.abs(pct) / scale) * BAR_HALF);
  return (
    <span className="wl-bar" aria-hidden="true">
      <span
        className={`wl-bar-fill ${t}`}
        style={pct > 0 ? { left: BAR_HALF, width: w } : { right: BAR_HALF, width: w }}
      />
    </span>
  );
}

function WatchlistPage() {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const { quotes, loading, refreshMarket } = usePortfolioData();
  const { symbols, loadFailed, names, reload, add, remove } = useWatchlist();
  const { alerts, reload: reloadAlerts } = useAlerts();
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
  const listRef = useRef<HTMLIonListElement>(null);
  useIonViewWillEnter(() => {
    // A row left swiped open closes behind a pushed page.
    listRef.current?.closeSlidingItems();
    const list = symbolsRef.current;
    if (list?.length) refreshMarket(list);
    reloadAlerts();
  }, [refreshMarket, reloadAlerts]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    try {
      const [list] = await Promise.all([reload(), reloadAlerts()]);
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

  // The search field shows only while adding. It opens focused, inside the
  // tap, which is the only time iOS raises the keyboard for it.
  const [adding, setAdding] = useState(false);
  const openSearch = () => {
    listRef.current?.closeSlidingItems();
    flushSync(() => setAdding(true));
    inputRef.current?.focus();
  };
  const searchMode = adding && query.trim() !== "";
  const cancelSearch = () => {
    setQuery("");
    setAdding(false);
    inputRef.current?.blur();
  };

  const watching = new Set(symbols ?? []);
  const alerted = new Set(alerts?.filter(isOn).map((a) => a.symbol));
  const toggle = (r: SymbolResult) => (watching.has(r.symbol) ? remove(r.symbol) : add(r.symbol, r.name));
  const openSymbol = (symbol: string) => history.push(`${tabBase}/symbol/${encodeURIComponent(symbol)}`);
  // As on iOS, a row left open closes at the next tap in the list, which does
  // nothing else (Ionic's own rows close only when another starts to slide),
  // or as soon as the page scrolls.
  // A mouse drag ends in a click (a finger's doesn't): that one is the
  // slide's own, and leaves the row open.
  const draggedAt = useRef(0);
  const closeOpenRow = (e: ReactMouseEvent) => {
    if (Date.now() - draggedAt.current < 300) return;
    const open = listRef.current?.querySelector(
      "ion-item-sliding.item-sliding-active-options-end:not(.item-sliding-closing)",
    );
    if (!open || (e.target as Element).closest("ion-item-option")) return;
    e.stopPropagation();
    e.preventDefault();
    listRef.current?.closeSlidingItems();
  };
  const barScale = Math.max(
    BAR_FLOOR_PCT,
    ...(symbols ?? []).map((s) => (quotes[s] ? Math.abs(latest(quotes[s]).pct) : 0)),
  );

  const listView =
    symbols === null ? (
      loadFailed && <p className="wl-status">Your watchlist couldn’t be loaded. Pull down to try again.</p>
    ) : symbols.length === 0 ? (
      <section className="wl-empty">
        <div className="wl-empty-symbol">{ICONS.eye}</div>
        <h2>Keep an eye on the market.</h2>
        <p>
          Add a ticker or company to follow.
          <br />
          Its price and today’s move will show up here.
        </p>
        <button type="button" className="ds-action" onClick={openSearch}>
          Find a symbol
        </button>
      </section>
    ) : (
      <>
        <div className="wl-list-heading">
          <span className="wl-count">
            {symbols.length} {symbols.length === 1 ? "symbol" : "symbols"}
          </span>
        </div>
        {/* A plain element catches the tap: Ionic's wrapper takes onClickCapture for a custom event. */}
        <div onClickCapture={closeOpenRow}>
          <IonList ref={listRef} className="wl-list wl-slides" lines="none">
            {symbols.map((symbol) => {
              const q = quotes[symbol];
              const name = q?.shortName ?? names[symbol];
              const at = q && latest(q);
              return (
                <IonItemSliding key={symbol} className="wl-slide" onIonDrag={() => (draggedAt.current = Date.now())}>
                  <IonItem className="wl-item" lines="none">
                    <button
                      type="button"
                      className="wl-row"
                      aria-label={[symbol, name, q && describe(q), alerted.has(symbol) && "price alert on"]
                        .filter(Boolean)
                        .join(", ")}
                      onClick={() => openSymbol(symbol)}
                    >
                      <span className="wl-identity">
                        <span className="wl-symbol">
                          {symbol}
                          {alerted.has(symbol) && <span className="wl-alert-mark">{ICONS.bell}</span>}
                        </span>
                        {name && <span className="wl-meta">{name}</span>}
                      </span>
                      {q && at ? (
                        <span className="wl-end">
                          <span className="wl-price">
                            {at.session && <span className="wl-session">{SESSION_ICONS[at.session]}</span>}
                            <span className="money">{fmtPrice(at.price)}</span>
                            {q.currency !== "USD" && <span className="wl-ccy">{q.currency}</span>}
                          </span>
                          <MoveBar pct={at.pct} scale={barScale} />
                          <span className={`wl-move money ${tone(at.pct)}`}>{fmtMove(at.pct)}</span>
                        </span>
                      ) : (
                        !loading.market && <span className="wl-no-quote">No price</span>
                      )}
                    </button>
                  </IonItem>
                  {/* Swiped all the way across, the row goes at once. */}
                  <IonItemOptions side="end" onIonSwipe={() => remove(symbol)}>
                    <IonItemOption
                      className="wl-remove"
                      expandable
                      aria-label={`Remove ${symbol} from watchlist`}
                      onClick={() => remove(symbol)}
                    >
                      Remove
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              );
            })}
          </IonList>
        </div>
        <p className="wl-footer">
          Prices in each symbol’s own currency.
          <br />
          The same watchlist in every portfolio.
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
      <IonContent scrollEvents onIonScroll={onIonScroll} onIonScrollStart={() => listRef.current?.closeSlidingItems()}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="wl-heading" ref={headingRef}>
          <h1>Watchlist</h1>
          {!adding && (
            <button type="button" className="wl-icon-button" aria-label="Add symbol" onClick={openSearch}>
              {ICONS.plus}
            </button>
          )}
        </div>

        {adding && (
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
            <button type="button" className="wl-cancel" onClick={cancelSearch}>
              Cancel
            </button>
          </div>
        )}

        {searchMode ? searchView : listView}
      </IonContent>
    </IonPage>
  );
}

export default WatchlistPage;
