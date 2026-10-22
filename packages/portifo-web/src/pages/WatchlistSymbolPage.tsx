import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import type { RefresherEventDetail } from "@ionic/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { RouteComponentProps } from "react-router-dom";
import HoldingChart from "../components/HoldingChart";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useWatchlist } from "../context/WatchlistContext";
import { BACK_ICON } from "../lib/backIcon";
import { fmtCcy, fmtEtDay, fmtEtStamp, fmtEtTime, fmtSignedCcy, fmtSignedPct } from "../lib/fx";

// A watched symbol, pushed from the Watchlist: the holding page's anatomy and
// classes (.hd-*) without the ownership. Read top to bottom:
//   0. The symbol — its name and exchange, and when the price was set.
//   1. The price — the hero figure, with today's move under it. (A holding
//      ends its title line with the price instead, because its hero is the
//      position's value; there is no position here.)
//   2. The market — the same price-history chart a holding shows.
//   3. The latest session — open, previous close, the day's range, volume.
// The Back bar's one quiet button takes the symbol off the watchlist, or puts
// it back, without leaving the page.
//
// Every figure is in the symbol's own currency.

// Coloured by the percentage as shown: a move that rounds to 0.0% is no move.
const tone = (pct: number) => {
  const shown = Math.round(pct * 10) / 10;
  return shown > 0 ? "positive" : shown < 0 ? "negative" : "";
};
const fmtVolume = (n: number) => n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

const icon = (body: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {body}
  </svg>
);
const ICONS = {
  plus: icon(<path d="M12 5v14M5 12h14" />),
  check: icon(<path d="m5 12.5 4.5 4.5L19 7.5" />),
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="hd-metric-label">{label}</div>
      <div className="money">{value}</div>
    </div>
  );
}

// Symbols such as EURUSD=X reach the route still percent-encoded.
function decodeSymbol(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function WatchlistSymbolPage({ match }: RouteComponentProps<{ symbol: string }>) {
  const symbol = decodeSymbol(match.params.symbol);
  const { tabBase, tabLabel } = useTabBase();
  const { quotes, loading, refreshMarket } = usePortfolioData();
  const { symbols, names, add, remove } = useWatchlist();
  const quote = quotes[symbol];
  // Counts pulls to refresh, so the chart refetches its range on each.
  const [pulls, setPulls] = useState(0);

  useEffect(() => {
    if (!quotes[symbol]) refreshMarket([symbol]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    setPulls((n) => n + 1);
    try {
      await refreshMarket([symbol]);
    } finally {
      e.detail.complete();
    }
  };

  const watching = symbols?.includes(symbol) ?? false;
  const name = quote?.shortName ?? names[symbol];
  const company = [name, quote?.exchange].filter(Boolean);
  const quoteTime = quote?.marketTime ? new Date(quote.marketTime) : null;
  const quoteStamp = quoteTime
    ? quote?.marketState === "REGULAR"
      ? `At ${fmtEtTime(quoteTime)}`
      : `At close · ${fmtEtDay(quoteTime)}`
    : null;
  const quoteLoading = !quote && loading.market;

  const price = quote ? fmtCcy(quote.price, quote.currency) : "";

  return (
    <IonPage className="hd-page wl-symbol-page">
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={tabBase} text={tabLabel} icon={BACK_ICON} />
          </IonButtons>
          <IonTitle>{symbol}</IonTitle>
          {symbols !== null && (
            <button
              type="button"
              slot="end"
              className="wl-watch-button"
              aria-pressed={watching}
              aria-label={watching ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
              onClick={() => (watching ? remove(symbol) : add(symbol, name))}
            >
              {watching ? ICONS.check : ICONS.plus}
            </button>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">
              <div className="hd-title-row">{symbol}</div>
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        {/* Reserves its line while the quote loads, so nothing below jumps. */}
        {(company.length > 0 || quoteLoading || quoteStamp) && (
          <div className="hd-company">
            <span>
              {company.length > 0
                ? company.map((part, i) => (
                    <span key={i}>
                      {i > 0 && <span className="dot">·</span>}
                      {part}
                    </span>
                  ))
                : " "}
            </span>
            {quoteStamp && <span className="hd-quote-stamp">{quoteStamp}</span>}
          </div>
        )}

        {quote ? (
          <>
            <section className="hd-hero" aria-label="Share price">
              <div className="hd-hero-label">Share price · {quote.currency}</div>
              <div className={`hd-hero-value money${price.length > 12 ? " compact" : ""}`}>{price}</div>
              <div className="hd-hero-returns">
                <span className={`money ${tone(quote.changePercent)}`}>{fmtSignedCcy(quote.change, quote.currency)}</span>
                <span className={`money hd-pill ${tone(quote.changePercent)}`}>{fmtSignedPct(quote.changePercent)}</span>
                <span className="hd-return-label">Today</span>
              </div>
            </section>

            <section className="hd-market" aria-label="Share price history">
              <HoldingChart symbol={symbol} ccy={quote.currency} reloadKey={pulls} />
            </section>

            <section className="hd-section">
              <div className="hd-section-heading">
                <h2>Latest session</h2>
                <span className="meta">{quote.marketState === "REGULAR" ? "Market open" : "Market closed"}</span>
              </div>
              <div className="hd-position-grid">
                {quote.open > 0 && <Metric label="Open" value={fmtCcy(quote.open, quote.currency)} />}
                {quote.previousClose != null && (
                  <Metric label="Previous close" value={fmtCcy(quote.previousClose, quote.currency)} />
                )}
                {quote.dayLow > 0 && <Metric label="Day low" value={fmtCcy(quote.dayLow, quote.currency)} />}
                {quote.dayHigh > 0 && <Metric label="Day high" value={fmtCcy(quote.dayHigh, quote.currency)} />}
                {quote.volume > 0 && <Metric label="Volume" value={fmtVolume(quote.volume)} />}
              </div>
            </section>

            <div className="hd-footer-note">
              All amounts in {quote.currency}
              {quoteTime && (
                <>
                  <br />
                  Quote as of {fmtEtStamp(quoteTime)}
                </>
              )}
            </div>
          </>
        ) : quoteLoading ? (
          <div className="hd-quote-note loading wl-symbol-note" role="status">
            <span className="hd-spinner" aria-hidden="true" />
            <div>
              <strong>Loading market data</strong>
              The price and its chart will appear when a quote arrives.
            </div>
          </div>
        ) : (
          <div className="hd-quote-note wl-symbol-note" role="status">
            <strong>We couldn’t get a current quote</strong>
            The price and its chart are unavailable for now.
            <button type="button" className="hd-text-link" onClick={() => refreshMarket([symbol])}>
              Try again <span aria-hidden="true">↻</span>
            </button>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

export default WatchlistSymbolPage;
