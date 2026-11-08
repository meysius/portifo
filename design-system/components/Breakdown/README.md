# Breakdown

How the whole portfolio splits: one bar with a block per position and one for the cash, and every part's percentage listed under it.

## When to use
Portfolio's Breakdown section, above the Holdings ledger. It is the only place a position's share of the portfolio is shown.

## What you provide
- Each open position's symbol, value and breakdown colour by rank (`ds-hold-1`…`ds-hold-5`, then `ds-hold-other`).
- The cash total, in `ds-cash`.
- Percentages of the whole portfolio, cash included.

## Rules
- Holdings largest first, then Cash, always last whatever its size. `ds-cash` is almost the same colour as `ds-hold-1` and `ds-hold-5` for colour-blind readers, so its fixed place is what identifies it. Don't rank it in among the holdings.
- Bar: 14px tall, full section width, 5px corners. Blocks are proportional to value, with a 2px gap showing the ground between them and a 2px minimum width so a sliver of a position still shows.
- Every position keeps its own block and legend entry. Past the fifth they share `ds-hold-other`; don't merge them into one "Other".
- A part at zero or below draws no block but stays in the legend, so negative cash reads "Cash −16.6%".
- Legend 14px under the bar: two columns 28px apart with a 7px row gap, reading down the first column and then the second, in the bar's order. A 7px dot with 2px corners, the name in `--ds-fs-11` `ds-secondary`, and the percentage in mono `--ds-fs-11` 500 `ds-text`, at the end of its column with one decimal.
- Percentages only: amounts are in the ledger directly below.
- The bar is `role="img"`, its `aria-label` naming every part and its percentage.
- With no holdings the bar is all Cash, followed by the note "No stock holdings. Your portfolio is held in cash."

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.po-allocation-*`, `.po-legend-*`).
