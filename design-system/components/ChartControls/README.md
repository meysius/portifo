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
- 1D draws the last session as 5-minute candles in place of the line. The time scale spans the session's full hours, so the day fills in from the left as it trades. A candle that closed at or above its open is `ds-positive`, one that closed below it `ds-negative`: a 1px wick from high to low, a body 70% of its slot (at most 9px, at least 1px tall). Volume stays `ds-muted` beneath.
- 1D is live: while the market is open and the chart is on screen, it refreshes every 5 seconds, and the share price and returns above it move with it. Candles redraw in place, without animation. Closed, it checks once a minute.
- Scrubbing a candle shows its close, currency and start time, then its open, high and low on a second line in mono `ds-secondary` ("O 340.10 H 340.50 L 339.90").

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.hd-chart-controls`, `.hd-range`, `.hd-indicator*`) and `src/components/HoldingChart.tsx`.
