# EmptyState

What a list shows when it has nothing to show: a line icon, a headline, two short lines, and the way forward.

## When to use
- Nothing recorded yet: the first visit to Transactions or Accounts.
- Nothing matches: filters or a search hide every record.
Not for errors or loading.

## What you provide
- A 20px line icon that names the list (the ledger for Transactions; a search glass when filters hide everything).
- A headline. For a first visit it can be warm ("Your story starts here."); for no matches, plain ("No matching transactions").
- Two short lines: what to do, and a reassurance or reason. "Bought your first shares? Moved some cash? / Add a transaction to start your record." "Try another symbol, type or account. / Your other records are still here."
- One action: a primary that starts the first record ("Add your first transaction"), or a secondary that undoes the filter ("Clear filters"). It must do exactly what the page's own add button does.

## Rules
- Centred, with 44px (Transactions) or 56px (Accounts) above and below.
- Symbol: 62px square, radius 18px, `ds-muted` on `ds-subtle`, 23px above the headline. Never an emoji or an illustration.
- Headline in `empty-title` (Inter 550, `--ds-fs-22`, −0.8px), 12px above the copy. Copy `--ds-fs-11`, line-height 1.8, `ds-secondary`.
- The button follows the `Button` rules, 18px below the copy.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.tl-empty`, `.ac-empty`, `.tl-action`).
