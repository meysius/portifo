import { IonContent, IonPage, IonRefresher, IonRefresherContent } from "@ionic/react";
import type { RefresherEventDetail } from "@ionic/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useHistory } from "react-router-dom";
import AddAccountModal from "../components/AddAccountModal";
import StickyTitleBar from "../components/StickyTitleBar";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useDisplayCurrency } from "../lib/displayCurrency";
import { convert, fmtCcy } from "../lib/fx";
import { useHeadingScrolledAway } from "../lib/useHeadingScrolledAway";

// The Accounts tab, from design-poc/accounts.html: your accounts, not another
// dashboard. One generic icon, the name, and the account's total value — the
// transactions ledger's 60px rows, 10px gaps and 32px glyphs. An account
// pushes its own page, one level deeper.

const icon = (body: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {body}
  </svg>
);
const PLUS = icon(<path d="M12 5v14M5 12h14" />);
const ACCOUNT = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M3 10h18M7 15h3" />
  </>,
);

// An unusually long total shrinks half a pixel at a time, never below 10px;
// the font scale still sets every ordinary row.
function AccountValue({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("font-size");
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && size > 10) el.style.fontSize = `${(size -= 0.5)}px`;
  });
  return (
    <span ref={ref} className="ac-account-value money">
      {text}
    </span>
  );
}

function AccountsPage() {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const { accounts, loading, refreshAccounts, refreshTransactions, refreshMarket, openPositionsFor, quotes, fxRates, tickerAggregates } =
    usePortfolioData();
  const [ccy] = useDisplayCurrency();
  const [addOpen, setAddOpen] = useState(false);
  const { headingRef, away, onIonScroll } = useHeadingScrolledAway<HTMLDivElement>();

  // Totals are at market, so quotes for every open symbol are loaded even when
  // this tab is visited before Portfolio.
  const symbolsKey = tickerAggregates
    .filter((t) => !t.closed)
    .map((t) => t.symbol)
    .join(",");
  useEffect(() => {
    if (symbolsKey) refreshMarket(symbolsKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  // A pull refetches all three inputs of a total: ledger, balances and quotes.
  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    try {
      await Promise.all([
        refreshAccounts({ silent: true }),
        refreshTransactions({ silent: true }),
        symbolsKey ? refreshMarket(symbolsKey.split(",")) : Promise.resolve(),
      ]);
    } finally {
      e.detail.complete();
    }
  };

  // Holdings at market (at cost while a quote is missing) plus the account's
  // own cash, in the display currency: the same figure its page leads with.
  const totalOf = (name: string, balances: { currency: string; balance: number }[]) => {
    let total = balances.reduce((sum, b) => sum + convert(b.balance, b.currency, ccy, fxRates), 0);
    for (const p of openPositionsFor(name)) {
      const q = quotes[p.symbol];
      total += q
        ? convert(q.price * p.shares, q.currency, ccy, fxRates)
        : p.costByCurrency.reduce((sum, [c, amount]) => sum + convert(amount, c, ccy, fxRates), 0);
    }
    return total;
  };

  const ready = !loading.accounts || accounts.length > 0;

  return (
    <IonPage className="tab-root-page ds-screen ac-page">
      <StickyTitleBar title="Accounts" shown={away} />
      <IonContent scrollEvents onIonScroll={onIonScroll}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="ac-heading" ref={headingRef}>
          <h1>Accounts</h1>
          <button type="button" className="ds-icon-button" aria-label="Add account" onClick={() => setAddOpen(true)}>
            {PLUS}
          </button>
        </div>

        {accounts.length > 0 && (
          <>
            <div className="ac-account-list">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="ac-account-row"
                  onClick={() => history.push(`${tabBase}/account/${a.id}`)}
                >
                  <span className="ac-account-icon">{ACCOUNT}</span>
                  <span className="ac-account-body">
                    <span className="ac-account-name">{a.name}</span>
                  </span>
                  <AccountValue text={fmtCcy(totalOf(a.name, a.balances), ccy)} />
                </button>
              ))}
            </div>
            <p className="ac-list-footer">
              Total account values in {ccy}
              <br />
              Manually tracked
            </p>
          </>
        )}

        {ready && accounts.length === 0 && (
          <section className="ac-empty">
            <div className="ac-empty-symbol">{ACCOUNT}</div>
            <h2>A place for your portfolio.</h2>
            <p>
              Start with your brokerage, bank or wallet.
              <br />
              Bring the rest together, one account at a time.
            </p>
            <button type="button" className="ds-action" onClick={() => setAddOpen(true)}>
              Add your first account
            </button>
          </section>
        )}

        <AddAccountModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      </IonContent>
    </IonPage>
  );
}

export default AccountsPage;
