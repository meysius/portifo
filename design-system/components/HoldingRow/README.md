# HoldingRow

One position in the Portfolio ledger: its share of the whole as a ring, the symbol and shares, and its value and return.

## When to use
In Portfolio's Holdings section, one per open position, then one Cash row, then one collapsed "Closed positions" row. For an account's holdings, the simpler two-line row in `AccountRow` is used instead.

## What you provide
- The weight: the position's share of the whole portfolio, cash included, and its breakdown colour by rank (`ds-hold-1`…`ds-hold-5`, then `ds-hold-other`; cash `ds-cash`).
- Symbol, share count ("250 shares"), value, and the total return as amount · percentage.
- For cash: "Cash", "Uninvested", the cash total, and the currencies it is held in, largest first ("CAD · USD"). Tapping it pushes the Cash page (where the cash is, by currency and by account).
- For closed positions: the count and the summed realized return; expanded, each sale is a shorter row without a ring ("Sold Sep 30").

## Rules
- A caption above the list names the two columns: "Holding / shares" and "Value / total return" in `row-meta` `ds-muted`.
- 15px block padding, 11px gap (12px padding on closed rows).
- Weight ring: 44 × 44 scaled with the type (52.8px), a 2.5px `ds-line` track and the holding's colour filled clockwise from twelve o'clock; the percentage inside in mono `--ds-fs-10` `ds-secondary`.
- Symbol `--ds-fs-12` 600; meta `--ds-fs-9` `ds-secondary`, 5px below.
- Value mono `--ds-fs-12` 500; return mono `--ds-fs-9` in gain/loss colour, 6px below, as "+$3,402.10 · +12.2%".
- Rows bleed 10px into the gutter on both sides so the press highlight (`ds-subtle`) is wider than the text, while the text stays on the gutter edge.
- One `ds-line` hairline under each row; none under the last.
- The whole row is the button. Give it an `aria-label` that reads the row as a sentence when its parts don't.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.po-holding-row`, `.po-weight-ring`, `.po-closed-row`).
