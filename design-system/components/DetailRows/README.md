# DetailRows

Label and value pairs that describe one record, under its figure.

## When to use
In a record's sheet (a transaction's details), and anywhere one thing's facts are listed rather than compared. Detail is read-only: changing a record happens elsewhere.

## What you provide
- Optionally a figure block: the 46px kind icon, the amount, and a one-line caption of its effect ("Deducted from account cash · USD").
- The pairs, in the app's order: Account, Date, Currency, then for a trade Security, Shares, Price per share, Purchase value or Sale proceeds (and Realized gain / loss on a sale), or for cash Amount; then Recorded by and Note when present.
- A closing notice that sets expectations: "This is a recorded transaction, not a live order. Cash movement is not the same as investment profit or loss."

## Rules
- Figure block: kind icon 46px, radius 12px, 13px above the amount; amount in `hero-figure`; caption `--ds-fs-10` `ds-secondary`, 7px below. 18px below the block.
- Each pair is one row: 14px block padding, a `ds-line` hairline under it, `--ds-fs-11`. Label on the left in `ds-secondary`; value on the right in `ds-text`, right-aligned, wrapping within 65% of the row.
- Figures in values are mono (`.money`); dates and names are not. Only a realized gain / loss takes gain/loss colour.
- Write the date in full ("October 3, 2025").

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.tl-detail-hero`, `.tl-detail-pair`).
