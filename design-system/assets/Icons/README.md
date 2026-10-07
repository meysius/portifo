# Icons

Line icons on a 24×24 grid with round caps and joins and no fill, copied from the app's inline SVG (`src/Tabs.tsx`, `src/pages/TransactionsPage.tsx`, `src/pages/AccountsPage.tsx`, `src/pages/AccountDetailPage.tsx`, `src/pages/HoldingsPage.tsx`, `src/lib/backIcon.ts`). In the app every icon strokes with `currentColor` and takes its control's ink; these copies fix the ink to `ds-text` light (`#162239`) so they show as images.

- `tab-portfolio.svg`, `tab-transactions.svg`, `tab-accounts.svg`: tab bar, 20px, 1.7 stroke. `tab-settings.svg`: the gear, 1.5 stroke.
- `back.svg`: the Back chevron, 22px, 2px stroke, in `ds-accent`.
- `plus.svg`: add, 20px, in an `IconButton`.
- `close.svg`: sheet close, 14px.
- `search.svg`: search field and the no-matches empty state, 16px.
- `chevron-down.svg`: inside a filter chip (rendered at 12px); opens a sheet.
- `chevron-down-small.svg`: the currency chip, 12px; opens a sheet.
- `chevron-right.svg`: a row that pushes a page, 14px, `ds-muted`.
- `portfolio-switch.svg`: after the Portfolio title, 16px, 2px stroke, `ds-muted`.
- `ledger.svg`: the Transactions empty state, 20px.
- `kind-buy.svg`, `kind-sell.svg`, `kind-deposit.svg`, `kind-withdraw.svg`: transaction kind glyphs, 18px, in their kind colours inside the 32px well.
- `edit.svg`: Rename account, 17px, quiet icon button.
- `cash.svg`: a cash balance glyph, 18px, `ds-accent` on `ds-accent-tint`.
- `account.svg`: an account glyph, 20px, `ds-secondary` on `ds-subtle`.

The first system's icons in `src/components/ds.tsx` (20×20 grid, 1.5 stroke) still serve the screens that haven't moved; don't use them on new work.
