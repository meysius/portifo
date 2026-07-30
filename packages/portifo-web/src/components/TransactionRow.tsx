import { IonItem, IonLabel } from "@ionic/react";
import type { Transaction } from "../api/portfolio";
import { fmtCcy } from "../lib/fx";

const TYPE_LABEL: Record<Transaction["type"], string> = {
  buy: "Buy",
  sell: "Sell",
  deposit: "Deposit",
  withdraw: "Withdraw",
};

/* Shares carry up to 4 decimals and trailing zeros are trimmed — "12 sh", not
   "12.0000 sh". The line is the widest thing in the right column and must never
   wrap, so it is the account beside it that clips. */
function fmtShares(shares: number) {
  return shares.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/*
 * A ledger row reads WHEN · WHAT MOVED · WHAT HAPPENED · HOW MUCH, AND HOW IT
 * GOT THERE (guidelines.html → Transaction row):
 *   .tx-rail  the day and weekday. This is the one list in the app whose rows
 *             do not lead with a glyph: the glyph could only say what the type
 *             chip says in words, and the month is already the section head, so
 *             the rail states only what varies inside the group.
 *   .sym      the ticker for Buy/Sell, the currency for Deposit/Withdraw, plus
 *             the type as a .tx-tag chip — coloured, because with no glyph it
 *             is the row's ONLY cue for what kind of movement this is.
 *   p         the account, alone, at full width.
 *   h2 (end)  the total, in the transaction's OWN currency — this is a ledger,
 *             so it must match what the user entered, not the display currency.
 *             Unsigned and in neutral ink: the type carries direction, and a
 *             losing Sell still receives positive cash.
 *   .tx-calc  shares × price, directly under the total it multiplies to. The
 *             row shows its own arithmetic, which is what a confirmation does.
 * A Sell adds one realized-P&L line, unlabelled — the only tinted figure in a
 * ledger row could not mean anything else, and "Realized:" cost 50pt of the
 * account's width to say so.
 */
function TransactionRow({ tx, realizedPL, onClick }: { tx: Transaction; realizedPL?: number; onClick?: () => void }) {
  const isTrade = tx.type === "buy" || tx.type === "sell";
  const isSell = tx.type === "sell";

  const total = isTrade ? (tx.shares ?? 0) * (tx.pricePerShare ?? 0) : (tx.amount ?? 0);
  const pl = realizedPL ?? 0;
  const positive = pl >= 0;
  /* U+2212, not a hyphen — it is a minus sign in front of a figure, and it
     matches the digit width in the mono face. Both halves of the line carry it:
     "−$1,360.00 · 18.8%" reads as a loss of $1,360 and a GAIN of 18.8%. */
  const sign = positive ? "+" : "−";
  const cost = total - pl;
  const plPct = isSell && cost > 1e-9 ? (pl / cost) * 100 : 0;

  const date = new Date(`${tx.date}T00:00:00`);
  const day = date.toLocaleDateString("en-US", { day: "2-digit" });
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <IonItem className="tx-row" button={!!onClick} detail={!!onClick} onClick={onClick}>
      <div className="tx-rail" slot="start">
        <div className="tx-day">{day}</div>
        <div className="tx-dow">{weekday}</div>
      </div>
      <IonLabel className="label-sym">
        <h2>
          {isTrade ? tx.symbol : tx.currency} <span className={`tx-tag ${tx.type}`}>{TYPE_LABEL[tx.type]}</span>
        </h2>
        <p>{tx.account}</p>
      </IonLabel>
      <IonLabel slot="end">
        <h2>{fmtCcy(total, tx.currency)}</h2>
        {isTrade && (
          <p className="tx-calc">
            {fmtShares(tx.shares ?? 0)} sh @ {fmtCcy(tx.pricePerShare ?? 0, tx.currency)}
          </p>
        )}
        {isSell && (
          <p className={positive ? "positive" : "negative"}>
            {sign}
            {fmtCcy(Math.abs(pl), tx.currency)} · {sign}
            {Math.abs(plPct).toFixed(1)}%
          </p>
        )}
      </IonLabel>
    </IonItem>
  );
}

export default TransactionRow;
