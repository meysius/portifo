# FilterChips

A row of filters, each showing its current value and opening an `OptionList` sheet.

## When to use
Above a long list that people narrow by a few known dimensions: Transactions by symbol, type and account. Two to three chips; more belong in a single "Filter" sheet.

## What you provide
- A group label ("Filter history") and a "Clear all" text action that appears only when a filter is set.
- For each chip, the dimension ("Symbol", "Type", "Account") and its current value ("All symbols", "Buy", "Joint brokerage").
- The result count under the chips ("21 records"), announced politely to screen readers.

## Rules
- Group label in `eyebrow` style, `ds-muted`; "Clear all" in `ds-accent` on the right.
- Chips sit in an equal three-column grid, 7px apart, each at least 52px: padding 8px × 10px, radius 10px, a 1px `ds-line` border, `ds-text` on `ds-subtle`.
- Dimension `--ds-fs-9` `ds-secondary`, 4px above the value; value `--ds-fs-10` 550, truncating with an ellipsis, followed by a 12px `chevron-down` (it opens a sheet).
- A set filter turns the whole chip `ds-accent` (border, label and value) on `ds-accent-tint`.
- Under the chips, a 4px `ds-subtle` band separates the filters from the list, with the count right-aligned in `row-meta` `ds-muted`.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.tl-filters`, `.tl-filter-chip*`, `.tl-ledger-heading`).
