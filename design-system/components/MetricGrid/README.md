# MetricGrid

Two columns of labelled figures, for the numbers behind a hero.

## When to use
When a screen has two to eight supporting figures that are read, not compared down a list: an account's Investments / Cash split under its hero, a holding's Position section (Shares held, Average cost / share, Total cost, Average age).

## What you provide
Pairs of label and value. Labels are short nouns in sentence case; values are formatted figures, or "—" when unknown.

## Rules
- Two equal columns. Labels in `--ds-fs-10` `ds-secondary`, 5–7px above the value; values mono `--ds-fs-13` in `ds-text`, wrapping rather than truncating.
- The split under a hero sits inside the gutter with a `ds-line` hairline above it (17px padding-top) and a hairline between the columns (17px in), 23px above whatever follows. Show it only when both halves are non-zero: a cash-only account would otherwise print "Investments $0.00".
- Inside a section the grid has no rules: 18px between rows and 15px between columns.
- Gain/loss colour only on values that are returns.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.ac-balance-split`, `.ac-metric-label`, `.hd-position-grid`).
