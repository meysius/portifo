# AccountRow

A row for an account, a cash balance or an account's holding: a glyph or symbol, a name, and a value.

## When to use
- The Accounts list: one row per account; tapping pushes the account page.
- An account page's Cash section: one row per currency; tapping opens the Set cash balance sheet.
- An account page's Holdings section: a two-line row (symbol and value, then name, then return) that pushes holding detail.
- The Cash page, two lists:
  - Currencies (only when the cash is in more than one): one row per currency with its total across accounts, how many accounts hold it, and its share of the cash. It is a fact, not a control: a neutral glyph (`ds-secondary` on `ds-subtle`), no press state.
  - Accounts: each account's name as a group heading (`--ds-fs-11` 600, with its converted total on the right when it holds more than one currency), then one cash row per currency it holds. Tapping a row pushes that account.

## What you provide
The name (accounts are named by the person, so they wrap rather than truncate), the value in the right currency, and for a cash row the currency code and its name ("CAD", "Canadian Dollar").

## Rules
- Same geometry as `LedgerRow`: at least 60px, 10px padding and gap. Holding rows use 15px block padding instead.
- Glyph: 32px, radius 8px. An account is `ds-secondary` on `ds-subtle`; cash is `ds-accent` on `ds-accent-tint`.
- Name `--ds-fs-12` 600, wrapping (`overflow-wrap: anywhere`).
- Value mono `--ds-fs-11` 500 (holding rows `--ds-fs-12`), right-aligned, at most 48% of the row. An unusually long total shrinks half a pixel at a time, never below 10px.
- A cash balance shows in its own currency; account totals in the display currency.
- A cash balance always sits beside its currency code, because "$" alone can be US, Canadian or Australian dollars. When it isn't in the display currency, its converted value goes under it in `row-meta` `ds-secondary`, with "≈" before and the code after: "≈ $5,818.03 USD".
- A list ends with a centred footer note in `ds-muted`: "Total account values in USD · Manually tracked".
- Rows bleed 10px into the gutter on both sides so the press highlight (`ds-subtle`) is wider than the text, while the text stays on the gutter edge.
- One `ds-line` hairline under each row; none under the last.
- The whole row is the button. Give it an `aria-label` that reads the row as a sentence when its parts don't.

## Drift
Cash rows show a right chevron although they open a sheet. By the chevron rule that should be no chevron (like every other row) or a down chevron.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.ac-account-row`, `.ac-account-icon`, `.ac-cash-row`, `.ac-holding-row`, `.cash-account-heading`, `.cash-end`, `.cash-note`).
