# LedgerRow

One transaction in the history: a kind icon, what happened, and what it did to the account's cash.

## When to use
In the Transactions ledger, grouped under date headings. Tapping a row opens its details in a sheet (`DetailRows`).

## What you provide
- The kind: buy, sell, deposit or withdraw.
- A title: "Buy NVDA", "Sell AAPL", "Cash deposit", "Cash withdrawal".
- A meta line: "12 shares × $142.50" for a trade, or how a cash movement came about ("From a balance update").
- The cash impact, signed: a buy and a withdrawal are negative.
- The currency and account, joined with a middle dot ("USD · Joint brokerage").

## Rules
- Date headings: "Today · Oct 3", then "Sep 30"; the year only when it isn't this one. `meta` 500 in `ds-secondary`, 12px above the group.
- Rows are at least 60px, 10px padding, 10px gap.
- Kind icon: 32px, radius 8px, an 18px glyph. Buy `ds-accent` on `ds-accent-tint`; Sell `ds-sell` on `ds-sell-bg`; Deposit `ds-positive` on `ds-positive-bg`; Withdraw `ds-withdraw` on `ds-withdraw-bg`. Never red for money leaving.
- Title `--ds-fs-12` 600; meta `--ds-fs-9` `ds-secondary`, 3px below.
- Amount mono `--ds-fs-11` 500 in `ds-text` (not gain/loss colour: a buy is not a loss). The account under it in `fine-print` `ds-muted` is the one thing on the row allowed to clip with an ellipsis; the end column is at most half the row.
- Rows bleed 10px into the gutter on both sides so the press highlight (`ds-subtle`) is wider than the text, while the text stays on the gutter edge.
- One `ds-line` hairline under each row; none under the last.
- The whole row is the button. Give it an `aria-label` that reads the row as a sentence when its parts don't.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.tl-row`, `.tl-icon`, `.tl-date-heading`, `.tl-account`).
