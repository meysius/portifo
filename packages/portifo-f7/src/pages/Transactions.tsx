import { useEffect, useState } from "react";
import { Navbar, Page } from "framework7-react";
import { listTransactions } from "../api/transactions";
import type { Transaction } from "../api/transactions";
import { CashGlyph } from "../components/Glyphs.tsx";

const TYPE_LABEL: Record<Transaction["type"], string> = {
  buy: "Buy",
  sell: "Sell",
  deposit: "Deposit",
  withdraw: "Withdraw",
};

function fmtMoney(n: number, currency: string): string {
  const sign = n < 0 ? "−" : "+";
  try {
    return sign + new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Math.abs(n));
  } catch {
    return `${sign}${Math.abs(n).toFixed(2)} ${currency}`;
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function txAmount(tx: Transaction): number {
  if (tx.type === "buy") return -((tx.shares ?? 0) * (tx.pricePerShare ?? 0));
  if (tx.type === "sell") return (tx.shares ?? 0) * (tx.pricePerShare ?? 0);
  if (tx.type === "deposit") return tx.amount ?? 0;
  return -(tx.amount ?? 0);
}

// The Transactions tab: a flat list of every transaction across the
// portfolio's Investment Accounts. Read-only here — tapping a row will open
// the (not yet built) Transaction Detail screen. docs/system-design-2.html
// component vocabulary (.list/.row/.glyph) carries over unchanged from
// Holdings/Accounts; nothing new was needed for this content.
export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTransactions()
      .then(setTransactions)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load transactions"));
  }, []);

  return (
    <Page name="transactions">
      <Navbar large title="Transactions" />
      <div style={{ padding: "4px 16px 20px" }}>
        {error && <div className="empty-body">{error}</div>}

        {!error && !transactions && (
          <div className="auth-loading" style={{ height: 200, background: "transparent" }}>
            <span className="inline-spinner" />
          </div>
        )}

        {transactions && transactions.length === 0 && (
          <div className="empty" style={{ marginTop: 40 }}>
            <div className="empty-title">No transactions yet</div>
            <div className="empty-body">
              Add your first buy, sell, deposit, or withdrawal to start tracking this portfolio.
            </div>
          </div>
        )}

        {transactions && transactions.length > 0 && (
          <div className="list">
            {transactions.map((tx) => {
              const isTrade = tx.type === "buy" || tx.type === "sell";
              return (
                <div className="row" key={tx.id}>
                  <div className="glyph">
                    {isTrade ? <span className="sq" style={{ background: "var(--signal)" }} /> : <CashGlyph />}
                  </div>
                  <div className="row-main">
                    <div className="sym">
                      {isTrade ? tx.symbol : TYPE_LABEL[tx.type]}
                      {isTrade && <span className="closed-tag">{TYPE_LABEL[tx.type]}</span>}
                    </div>
                    <div className="name">
                      {tx.account} · {fmtDate(tx.date)}
                    </div>
                  </div>
                  <div className="row-end">
                    <div className="val">{fmtMoney(txAmount(tx), tx.currency)}</div>
                    {isTrade && (
                      <div className="meta">
                        {tx.shares} sh @ {fmtMoney(tx.pricePerShare ?? 0, tx.currency).slice(1)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}
