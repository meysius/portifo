import { IonItem, IonLabel } from "@ionic/react";
import type { Transaction } from "../api/portfolio";
import { fmtCcy } from "../lib/fx";
import { ArrowDownIcon, ArrowUpIcon, TxInGlyphIcon, TxOutGlyphIcon } from "./ds";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TYPE_LABEL: Record<Transaction["type"], string> = {
  buy: "Buy",
  sell: "Sell",
  deposit: "Deposit",
  withdraw: "Withdraw",
};

/*
 * A ledger row reads WHAT MOVED · WHAT HAPPENED · HOW MUCH (screens.html →
 * Transactions):
 *   .sym   the ticker for Buy/Sell, the currency for Deposit/Withdraw
 *   .name  `type · account`
 *   .val   the total, in the transaction's OWN currency — this is a ledger, so
 *          it must match what the user entered, not the display currency
 *   .meta  the date
 * Unsigned and in neutral ink: the glyph and the type carry the direction, and a
 * losing Sell still receives positive cash. Share maths lives on the detail
 * screen — at real account-name lengths it collided with the account.
 * A Sell adds one .pnl line for its realized P&L, the same stacked shape a
 * Holdings row uses.
 */
function TransactionRow({ tx, realizedPL, onClick }: { tx: Transaction; realizedPL?: number; onClick?: () => void }) {
  const isTrade = tx.type === "buy" || tx.type === "sell";
  const moneyIn = tx.type === "buy" || tx.type === "deposit";
  const isSell = tx.type === "sell";

  const total = isTrade ? (tx.shares ?? 0) * (tx.pricePerShare ?? 0) : (tx.amount ?? 0);
  const pl = realizedPL ?? 0;
  const positive = pl >= 0;
  const cost = total - pl;
  const plPct = isSell && cost > 1e-9 ? (pl / cost) * 100 : 0;

  return (
    <IonItem button={!!onClick} detail={!!onClick} onClick={onClick}>
      {/* Cash movements take the tinted well, trades the neutral one — the same
          pairing the Holdings list uses for its Cash row. */}
      <div className={`glyph ${isTrade ? "glyph-stock" : "glyph-cash"}`} slot="start">
        {moneyIn ? <TxInGlyphIcon /> : <TxOutGlyphIcon />}
      </div>
      <IonLabel className="label-sym">
        <h2>{isTrade ? tx.symbol : tx.currency}</h2>
        <p>
          {TYPE_LABEL[tx.type]} · {tx.account}
        </p>
      </IonLabel>
      <IonLabel slot="end">
        <h2>{fmtCcy(total, tx.currency)}</h2>
        <p>{formatDate(tx.date)}</p>
        {isSell && (
          <p className={positive ? "positive" : "negative"}>
            {positive ? <ArrowUpIcon /> : <ArrowDownIcon />}
            {positive ? "+" : "−"}
            {fmtCcy(Math.abs(pl), tx.currency)} · {Math.abs(plPct).toFixed(1)}%
          </p>
        )}
      </IonLabel>
    </IonItem>
  );
}

export default TransactionRow;
