import { IonContent, IonModal, IonPage, IonRefresher, IonRefresherContent } from "@ionic/react";
import type { RefresherEventDetail } from "@ionic/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useHistory } from "react-router-dom";
import type { Transaction, TransactionType } from "../api/portfolio";
import StickyTitleBar from "../components/StickyTitleBar";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { fmtCcy, fmtShares, fmtSignedCcy, fmtSignedPct } from "../lib/fx";
import { useHeadingScrolledAway } from "../lib/useHeadingScrolledAway";

// The Transactions tab, built from design-poc/transactions.html in the second
// design system (theme/ds.css). Read top to bottom:
//   1. The context — symbol, type and account filters directly above the
//      ledger, and the record count.
//   2. The record — one timeline grouped by day. Each row carries a quiet,
//      directional icon, an explicit label, and the signed cash it moved, in
//      the transaction's own currency. That is cash impact, not profit or loss.
// A row opens its detail in a sheet; editing is one explicit action from there.

type Filters = { symbol: string; type: TransactionType | "all"; account: string };
type FilterKey = keyof Filters;

const ALL: Filters = { symbol: "all", type: "all", account: "all" };

const LABEL: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  deposit: "Deposit",
  withdraw: "Withdrawal",
};

const TYPE_DETAIL: Record<TransactionType, string> = {
  buy: "Shares purchased",
  sell: "Shares sold",
  deposit: "Cash added to an account",
  withdraw: "Cash moved out of an account",
};

const FILTER_NAME: Record<FilterKey, string> = { symbol: "symbol", type: "transaction type", account: "account" };

const FILTER_INTRO: Record<FilterKey, string> = {
  symbol: "Choose a security. Cash movements appear under All symbols.",
  type: "Choose the kind of move you want to see.",
  account: "Choose an account to narrow your history.",
};

const isTrade = (t: Transaction) => t.type === "buy" || t.type === "sell";
const gross = (t: Transaction) => (isTrade(t) ? (t.shares ?? 0) * (t.pricePerShare ?? 0) : (t.amount ?? 0));
// What the move did to the account's cash: a buy and a withdrawal take it out.
const cashImpact = (t: Transaction) => (t.type === "buy" || t.type === "withdraw" ? -gross(t) : gross(t));
const titleOf = (t: Transaction) =>
  isTrade(t) ? `${LABEL[t.type]} ${t.symbol}` : t.type === "deposit" ? "Cash deposit" : "Cash withdrawal";
const sharesText = (n: number) => `${fmtShares(n)} ${n === 1 ? "share" : "shares"}`;
const records = (n: number) => `${n} ${n === 1 ? "record" : "records"}`;
const tone = (n: number) => (n > 1e-9 ? "positive" : n < -1e-9 ? "negative" : "");

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const longDate = (iso: string) =>
  day(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
// A day heading: "Today · Oct 3", "Sep 30", and the year once it isn't this one.
function dayHeading(iso: string) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const d = day(iso);
  const text = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  if (iso === isoDay(now)) return `Today · ${text}`;
  if (iso === isoDay(yesterday)) return `Yesterday · ${text}`;
  return text;
}

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
  plus: icon(<path d="M12 5v14M5 12h14" />),
  close: icon(<path d="m6 6 12 12M18 6 6 18" />, 14),
  search: icon(
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>,
    16,
  ),
  chevron: icon(<path d="m7 10 5 5 5-5" />, 14),
  ledger: icon(
    <>
      <path d="M4 7h16M4 12h10M4 17h16" />
      <path d="m17 10 3 2-3 2" />
    </>,
  ),
  buy: icon(<path d="M17 7 7 17M7 7v10h10" />, 18),
  sell: icon(<path d="M7 17 17 7M7 7h10v10" />, 18),
  deposit: icon(<path d="M12 3v11m-4-4 4 4 4-4M4 14v6h16v-6" />, 18),
  withdraw: icon(<path d="M12 14V3m-4 4 4-4 4 4M4 14v6h16v-6" />, 18),
};

const KindIcon = ({ type }: { type: TransactionType }) => <span className={`tl-icon ${type}`}>{ICONS[type]}</span>;

function Pair({ label, value, mono, className = "" }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className="tl-detail-pair">
      <span>{label}</span>
      <span className={`${mono ? "money" : ""} ${className}`}>{value}</span>
    </div>
  );
}

function SheetHeader({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  return (
    <>
      <div className="ds-sheet-grabber" aria-hidden="true" />
      <div className="ds-sheet-header">
        <h2 id={id}>{title}</h2>
        <button type="button" className="ds-close-sheet" aria-label="Close dialog" onClick={onClose}>
          {ICONS.close}
        </button>
      </div>
    </>
  );
}

function TransactionsPage() {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const { headingRef, away, onIonScroll } = useHeadingScrolledAway<HTMLDivElement>();
  const { transactions, accounts, quotes, realizedPLByTx, loading, refreshTransactions, refreshMarket } =
    usePortfolioData();

  const [filters, setFilters] = useState<Filters>(ALL);
  // Each sheet keeps what it shows after it closes, so it doesn't empty out
  // while it slides away.
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterKey, setFilterKey] = useState<FilterKey>("symbol");
  const [query, setQuery] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Edit pushes a page, which must wait for the sheet to finish leaving.
  const afterDetail = useRef<(() => void) | null>(null);

  const visible = (f: Filters) =>
    transactions.filter(
      (t) =>
        (f.symbol === "all" || t.symbol === f.symbol) &&
        (f.type === "all" || t.type === f.type) &&
        (f.account === "all" || t.account === f.account),
    );

  // Newest day first; within a day, the ledger's own order.
  const rows = useMemo(
    () => visible(filters).sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, filters],
  );
  const groups = useMemo(() => {
    const out = new Map<string, Transaction[]>();
    for (const t of rows) {
      const key = t.date.slice(0, 10);
      out.set(key, [...(out.get(key) ?? []), t]);
    }
    return [...out];
  }, [rows]);

  const accountNames = accounts.map((a) => a.name);
  const symbols = [...new Set(transactions.filter(isTrade).map((t) => t.symbol ?? ""))].filter(Boolean).sort();
  const active = filters.symbol !== "all" || filters.type !== "all" || filters.account !== "all";

  // A quote carries the company's name, which the symbol filter and the detail
  // sheet show. Portfolio fetches them for open positions; fetch the rest.
  const symbolsKey = symbols.join(",");
  useEffect(() => {
    const missing = symbols.filter((sym) => !quotes[sym]);
    if (missing.length) refreshMarket(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  const chipText: Record<FilterKey, string> = {
    symbol: filters.symbol === "all" ? "All symbols" : filters.symbol,
    type: filters.type === "all" ? "All types" : LABEL[filters.type],
    account: filters.account === "all" ? "All accounts" : filters.account,
  };

  const options = (key: FilterKey): [string, string, string][] => {
    if (key === "symbol")
      return [
        ["all", "All symbols", "Includes cash movements"],
        ...symbols.map((s): [string, string, string] => [s, s, quotes[s]?.shortName ?? "Recorded security"]),
      ];
    if (key === "type")
      return [
        ["all", "All types", "Trades & cash movements"],
        ...(Object.keys(LABEL) as TransactionType[]).map((t): [string, string, string] => [t, LABEL[t], TYPE_DETAIL[t]]),
      ];
    return [
      ["all", "All accounts", "Your complete portfolio"],
      ...accountNames.map((a): [string, string, string] => [a, a, "Manually tracked account"]),
    ];
  };

  const openFilter = (key: FilterKey) => {
    setQuery("");
    setFilterKey(key);
    setFilterOpen(true);
  };
  // Picking an option applies it and closes the sheet; each option already
  // shows how many records it leaves.
  const chooseFilter = (value: string) => {
    setFilters((f) => ({ ...f, [filterKey]: value }));
    setFilterOpen(false);
  };
  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };
  const addTransaction = () => history.push(`${tabBase}/add-transaction`);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    try {
      await refreshTransactions({ silent: true });
    } finally {
      e.detail.complete();
    }
  };

  const shownOptions = options(filterKey).filter(
    ([v, l, d]) => v === "all" || `${l} ${d}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const detail = transactions.find((t) => t.id === detailId) ?? null;
  const ready = !loading.transactions || transactions.length > 0;

  return (
    <IonPage className="tab-root-page ds-screen tl-page">
      <StickyTitleBar title="Transactions" shown={away} />
      <IonContent scrollEvents onIonScroll={onIonScroll}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="tl-heading" ref={headingRef}>
          <h1>Transactions</h1>
          <button type="button" className="tl-icon-button" aria-label="Add transaction" onClick={addTransaction}>
            {ICONS.plus}
          </button>
        </div>

        <section className="tl-filters" aria-label="Transaction filters">
          <div className="tl-filter-heading">
            <span>Filter history</span>
            {active && (
              <button type="button" className="tl-clear-filters" onClick={() => setFilters(ALL)}>
                Clear all
              </button>
            )}
          </div>
          <div className="tl-filter-grid">
            {(["symbol", "type", "account"] as FilterKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`tl-filter-chip${filters[key] !== "all" ? " is-active" : ""}`}
                aria-haspopup="dialog"
                aria-label={`Filter by ${key}: ${chipText[key]}`}
                onClick={() => openFilter(key)}
              >
                <span className="tl-filter-chip-label">{key[0].toUpperCase() + key.slice(1)}</span>
                <span className="tl-filter-chip-value">
                  <span>{chipText[key]}</span>
                  {ICONS.chevron}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="tl-ledger-heading">
          <span className="tl-result-count" aria-live="polite">
            {ready ? records(rows.length) : " "}
          </span>
        </div>

        {ready && rows.length === 0 && (
          <section className="tl-empty">
            <div className="tl-empty-symbol">{transactions.length === 0 ? ICONS.ledger : ICONS.search}</div>
            {transactions.length === 0 ? (
              <>
                <h2>Your story starts here.</h2>
                <p>
                  Bought your first shares? Moved some cash?
                  <br />
                  Add a transaction to start your record.
                </p>
                <button type="button" className="tl-action" onClick={addTransaction}>
                  Add your first transaction
                </button>
              </>
            ) : (
              <>
                <h2>No matching transactions</h2>
                <p>
                  Try another symbol, type or account.
                  <br />
                  Your other records are still here.
                </p>
                <button type="button" className="tl-action secondary" onClick={() => setFilters(ALL)}>
                  Clear filters
                </button>
              </>
            )}
          </section>
        )}

        {groups.map(([date, items]) => (
          <section key={date} className="tl-date-group" aria-label={longDate(date)}>
            <h2 className="tl-date-heading">{dayHeading(date)}</h2>
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                className="tl-row"
                aria-haspopup="dialog"
                onClick={() => openDetail(t.id)}
              >
                <KindIcon type={t.type} />
                <span className="tl-identity">
                  <span className="tl-title">{titleOf(t)}</span>
                  <span className="tl-meta">
                    {isTrade(t)
                      ? `${sharesText(t.shares ?? 0)} × ${fmtCcy(t.pricePerShare ?? 0, t.currency)}`
                      : t.fromBalanceUpdate
                        ? "From a balance update"
                        : t.type === "deposit"
                          ? "Cash added to account"
                          : "Cash moved out"}
                  </span>
                </span>
                <span className="tl-end">
                  <span className="money">{fmtSignedCcy(cashImpact(t), t.currency)}</span>
                  <span className="tl-account">
                    {t.currency} · {t.account}
                  </span>
                </span>
              </button>
            ))}
          </section>
        ))}

        {rows.length > 0 && (
          <div className="tl-ledger-footer">
            You’re all caught up.
            <br />
            Amounts show cash movement, in each transaction’s currency.
          </div>
        )}

        {/* ── filter sheet ─────────────────────────────────────────────── */}
        <IonModal
          isOpen={filterOpen}
          onDidDismiss={() => setFilterOpen(false)}
          initialBreakpoint={1}
          breakpoints={[0, 1]}
          handle={false}
          className="auto-sheet ds-sheet ds-screen tl-sheet"
          aria-labelledby="tl-filter-title"
        >
          <div className="ds-sheet-body">
            <SheetHeader
              id="tl-filter-title"
              title={`Filter by ${FILTER_NAME[filterKey]}`}
              onClose={() => setFilterOpen(false)}
            />
            <p className="tl-filter-intro">{FILTER_INTRO[filterKey]}</p>
            {filterKey === "symbol" && (
              <div className="tl-search-field">
                {ICONS.search}
                <input
                  type="search"
                  aria-label="Search symbols"
                  placeholder="Find a symbol or company…"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
            <div className="tl-filter-options" role="group" aria-labelledby="tl-filter-title">
              {shownOptions.map(([value, label, about]) => {
                const count = visible({ ...filters, [filterKey]: value }).length;
                const chosen = value === filters[filterKey];
                return (
                  <button
                    type="button"
                    className={`tl-filter-option${chosen ? " is-chosen" : ""}`}
                    key={value}
                    aria-pressed={chosen}
                    onClick={() => chooseFilter(value)}
                  >
                    <span className="tl-filter-option-mark" aria-hidden="true" />
                    <span className="tl-filter-option-copy">
                      <span className="tl-filter-option-title">{label}</span>
                      <span className="tl-filter-option-detail">{about}</span>
                    </span>
                    <span className="tl-filter-option-count" aria-label={`${count} matching records`}>
                      {count}
                    </span>
                  </button>
                );
              })}
              {shownOptions.length === 1 && query.trim() !== "" && (
                <p className="tl-filter-search-empty" role="status">
                  No symbols found.
                  <br />
                  Try a ticker or company name.
                </p>
              )}
            </div>
          </div>
        </IonModal>

        {/* ── detail sheet ─────────────────────────────────────────────── */}
        <IonModal
          isOpen={detailOpen && detail !== null}
          onDidDismiss={() => {
            setDetailOpen(false);
            afterDetail.current?.();
            afterDetail.current = null;
          }}
          initialBreakpoint={1}
          breakpoints={[0, 1]}
          handle={false}
          className="auto-sheet ds-sheet ds-screen tl-sheet"
          aria-labelledby="tl-detail-title"
        >
          {detail && (
            <div className="ds-sheet-body">
              <SheetHeader id="tl-detail-title" title={titleOf(detail)} onClose={() => setDetailOpen(false)} />
              <div className="tl-detail-hero">
                <KindIcon type={detail.type} />
                <div className="money">{fmtSignedCcy(cashImpact(detail), detail.currency)}</div>
                <div className="tl-detail-caption">
                  {cashImpact(detail) >= 0 ? "Added to" : "Deducted from"} account cash · {detail.currency}
                </div>
              </div>
              <Pair label="Account" value={detail.account} />
              <Pair label="Date" value={longDate(detail.date)} />
              <Pair label="Currency" value={detail.currency} />
              {isTrade(detail) ? (
                <>
                  <Pair
                    label="Security"
                    value={[detail.symbol, quotes[detail.symbol ?? ""]?.shortName].filter(Boolean).join(" · ")}
                  />
                  <Pair label="Shares" value={fmtShares(detail.shares ?? 0)} mono />
                  <Pair label="Price per share" value={fmtCcy(detail.pricePerShare ?? 0, detail.currency)} mono />
                  <Pair
                    label={detail.type === "buy" ? "Purchase value" : "Sale proceeds"}
                    value={fmtCcy(gross(detail), detail.currency)}
                    mono
                  />
                  {(() => {
                    // A sale's result against average cost; its own percentage.
                    const pl = realizedPLByTx.get(detail.id);
                    if (detail.type !== "sell" || pl == null) return null;
                    const cost = gross(detail) - pl;
                    return (
                      <Pair
                        label="Realized gain / loss"
                        value={`${fmtSignedCcy(pl, detail.currency)}${cost > 1e-9 ? ` · ${fmtSignedPct((pl / cost) * 100)}` : ""}`}
                        mono
                        className={tone(pl)}
                      />
                    );
                  })()}
                </>
              ) : (
                <Pair label="Amount" value={fmtCcy(detail.amount ?? 0, detail.currency)} mono />
              )}
              {detail.fromBalanceUpdate && <Pair label="Recorded by" value="Balance update" />}
              {detail.notes && <Pair label="Note" value={detail.notes} />}
              <p className="ds-sheet-notice">
                This is a recorded transaction, not a live order. Cash movement is not the same as investment profit or
                loss.
              </p>
              <button
                type="button"
                className="tl-action secondary"
                onClick={() => {
                  const id = detail.id;
                  afterDetail.current = () => history.push(`${tabBase}/add-transaction/${id}`);
                  setDetailOpen(false);
                }}
              >
                Edit transaction
              </button>
              <button type="button" className="tl-action secondary" onClick={() => setDetailOpen(false)}>
                Done
              </button>
            </div>
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
}

export default TransactionsPage;
