import { IonItem } from "@ionic/react";
import type { Transaction } from "../api/portfolio";
import { fmtCcy, fmtShares } from "../lib/fx";
import { ArrowDownIcon, ArrowUpIcon, CashGlyphIcon } from "./ds";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const CAT_COLORS = ["var(--c-1)", "var(--c-2)", "var(--c-3)", "var(--c-4)"];

// Stable categorical dot per symbol — same palette the allocation bar uses,
// assigned by hash rather than meaning.
function symbolColor(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) | 0;
  return CAT_COLORS[Math.abs(h) % CAT_COLORS.length];
}

// design-system.html's Transactions row: DS .row.tx — a glyph, ticker + type
// tag, account name, then a right column where the cash value always stays
// neutral ink (a losing Sell still receives positive cash) and shares @
// price, the same shape for both Buy and Sell. Date and a Sell's realized
// P&L both move to a third line (.row-foot) below, indented under the
// account name.
function TransactionRow({ tx, realizedPL, onClick }: { tx: Transaction; realizedPL?: number; onClick?: () => void }) {
  const dateStr = formatDate(tx.date);

  if (tx.type === "buy" || tx.type === "sell") {
    const isSell = tx.type === "sell";
    const shares = tx.shares ?? 0;
    const price = tx.pricePerShare ?? 0;
    const pl = realizedPL ?? 0;
    const positive = pl >= 0;
    const cost = shares * price - pl;
    const plPct = isSell && cost > 1e-9 ? (pl / cost) * 100 : 0;
    const total = shares * price;

    return (
      <IonItem className="tx-item" button={!!onClick} detail={false} onClick={onClick}>
        <div className="tx-row">
          <div className="tx-row-top">
            <div className="glyph glyph-stock">
              <span className="glyph-dot" style={{ background: symbolColor(tx.symbol ?? "") }} />
            </div>
            <div className="tx-row-main">
              <div className="tx-sym">
                {tx.symbol} <span className="type-tag">{isSell ? "Sell" : "Buy"}</span>
              </div>
              <div className="tx-name">{tx.account}</div>
            </div>
            <div className="tx-row-end">
              <div className="tx-val">
                {isSell ? "+" : "−"}
                {fmtCcy(total, tx.currency)}
              </div>
              <div className="tx-meta">
                {fmtShares(shares)} sh @ {fmtCcy(price, tx.currency)}
              </div>
            </div>
          </div>
          <div className="tx-row-foot">
            <div className="tx-date">{dateStr}</div>
            {isSell && (
              <div className={positive ? "tx-pnl positive" : "tx-pnl negative"}>
                {positive ? <ArrowUpIcon /> : <ArrowDownIcon />}
                {positive ? "+" : "−"}
                {fmtCcy(Math.abs(pl), tx.currency)} · {Math.abs(plPct).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </IonItem>
    );
  }

  const isDeposit = tx.type === "deposit";
  return (
    <IonItem className="tx-item" button={!!onClick} detail={false} onClick={onClick}>
      <div className="tx-row">
        <div className="tx-row-top">
          <div className="glyph glyph-cash">
            <CashGlyphIcon />
          </div>
          <div className="tx-row-main">
            <div className="tx-sym">
              Cash <span className="type-tag">{isDeposit ? "Deposit" : "Withdraw"}</span>
            </div>
            <div className="tx-name">{tx.account}</div>
          </div>
          <div className="tx-row-end">
            <div className="tx-val">
              {isDeposit ? "+" : "−"}
              {fmtCcy(tx.amount ?? 0, tx.currency)}
            </div>
            <div className="tx-meta">{tx.currency}</div>
          </div>
        </div>
        <div className="tx-row-foot">
          <div className="tx-date">{dateStr}</div>
        </div>
      </div>
    </IonItem>
  );
}

export default TransactionRow;
