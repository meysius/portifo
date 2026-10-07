# Section

A titled block of a page, separated from the one above by a 6px band.

## When to use
For every group below the hero: Holdings, Breakdown, Today’s movers, Position, Accounts, Cash. If a block has no title it is part of the hero or of the section above it.

## What you provide
- A short noun for the title ("Holdings", "Position", "Cash").
- Optionally meta on the right that explains the columns or counts ("Value / total return"), or a count right after the title.
- The content: rows, a metric grid, a chart.

## Rules
- A 6px `ds-subtle` band on top (`border-top`), never a hairline, a card or a shadow.
- Side padding `ds-gutter`; 17–21px top padding (see Drift).
- Title in `section-title`: Inter 600, `--ds-fs-16`, −0.4px. The heading row is `space-between` with a 10px gap and wraps on narrow screens.
- Meta in `meta` (`--ds-fs-10`) and `ds-muted`. A count after the title takes a 5px left margin.
- 13px from the heading to its content (4px when the rows below carry their own 15px padding).
- End a page with a footer note in `row-meta`, centred, `ds-muted`, saying what the figures are: "All amounts in USD · Average-cost accounting", "Total account values in USD · Manually tracked".
- Don't put a primary button inside a section. Text actions ("Show all", "Add currency") are fine.

## Drift
Section padding is 17px on Portfolio, 18px on an account and 21px on a holding; heading-to-content is 13px, 4px and 17px. Converge on one value per case when next touched.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.po-section*`, `.hd-section*`, `.ac-section*`, `.ac-list-footer`).
