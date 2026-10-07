# ChartControls

The range picker above a price chart and the indicator toggles under it.

## When to use
With a holding's price chart (and the portfolio's value chart, which shares the range picker). Ranges: 1D, 1W, 1M, 3M, 6M, 1Y, All.

## What you provide
- The ranges and the selected one.
- The indicator toggles ("200-day SMA", "SMA bands"), whether each is on, and when on, the value at the scrubbed or latest bar.
- A note when toggles don't apply to the range ("3M and longer").

## Rules
- Ranges sit above the plot, as in Apple Stocks, 4px apart. Each at least 38 × 30px, radius 6px, `--ds-fs-11` 500 in `ds-text`. The chosen range is 700 on a `ds-line` pill, so the accent stays on the price line.
- Indicator chips: at least 30px tall, padding 0 10px, radius 6px, a 1px `ds-line` border, `--ds-fs-10` 500. Off: `ds-secondary` with a muted swatch. On: `ds-text` with the swatch in its line colours (`ds-indicator`; bands `ds-band-15`, `ds-band-10`, `ds-band-5`, outermost on top).
- Each chip is its lines' legend: a 12px swatch, the name, then the value in mono.
- Disabled chips (range too short) drop to 45% opacity, with the note beside them in `ds-muted`.
- The plot itself: a vertical swipe scrolls the page, a horizontal one scrubs.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.hd-chart-controls`, `.hd-range`, `.hd-indicator*`) and `src/components/HoldingChart.tsx`.
