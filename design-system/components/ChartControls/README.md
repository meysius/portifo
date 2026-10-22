# ChartControls

The range picker above a price chart and the indicator toggle under it.

## When to use
With a holding's price chart (and the portfolio's value chart, which shares the range picker). Ranges: 1D, 1W, 1M, 3M, 6M, 1Y, All.

## What you provide
- The ranges and the selected one.
- The indicator toggle ("SMA bands": the 200-day average and the lines 5, 10 and 15% either side of it), whether it is on, and when on, how far the price sits from the average at the scrubbed or latest bar ("+4.6%").
- A note when the toggle doesn't apply to the range ("3M and longer"), or when it is on but the price crosses none of the lines ("Stayed between the SMA and −5%").

## Rules
- Ranges sit above the plot, as in Apple Stocks, 4px apart. Each at least 38 × 30px, radius 6px, `--ds-fs-11` 500 in `ds-text`. The chosen range is 700 on a `ds-line` pill, so the accent stays on the price line.
- The indicator chip: at least 30px tall, padding 0 10px, radius 6px, a 1px `ds-line` border, `--ds-fs-10` 500. Off: `ds-secondary` with a muted swatch. On: `ds-text`, with the swatch's three bars in the lines' colours as the chart stacks them: `ds-band-above`, the dashed `ds-text` average, then `ds-band-below`.
- The chip is its lines' legend: a 12px swatch, the name, then the value in mono.
- Only the lines the price crosses in the range are drawn, and the price scale stretches to hold them and no further. Because the price moves continuously, those lines are always one unbroken run from its low to its high.
- The average is a 1.5px dashed (4 3) `ds-text` line. Each band is a 1px line, `ds-band-above` over the average and `ds-band-below` under it, one colour a side. The zone between two neighbouring lines is tinted in the outer line's colour, deeper the farther out: 5%, 9% and 13% for the ±5, ±10 and ±15% zones. The tints replace the price's fill. When no zone is drawn, the price keeps its fill.
- Each drawn line is named (`+15%` … `SMA` … `−15%`) just past its right end, in mono `--ds-fs-8` `ds-secondary`. The names get a column of their own between the plot and the price scale, 6px in from the plot's edge, so a name never covers the price. Where lines run closer than 11px, their names are spaced 11px apart about the lines' own centre.
- With the bands on, scrubbing replaces the one-line tip with a readout of every drawn line the crosshair crosses, listed top down in the order they cross it, with the price slotted in where it sits. Each row is a 10px swatch in the line's colour (dashed for the average), its name (`+15%` … `−15%` in mono, then `SMA`, `Price`), and its value in mono. The date heads the names and the currency code heads the values. The price's row is 700 in `ds-text`; the other names are `ds-secondary`. It uses the tip's box (`--ds-fs-9`, 1px `ds-line` border, radius 5px, `ds-bg`) and hangs 10px to whichever side of the crosshair has more room, so the crossings stay visible. Each crossing gets a 2.5px dot in its line's colour.
- A disabled chip (range too short) drops to 45% opacity. Notes sit beside the chip in `ds-muted` and wrap under it when there isn't room.
- The plot itself: a vertical swipe scrolls the page, a horizontal one scrubs.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.hd-chart-controls`, `.hd-range`, `.hd-indicator*`; the scrub readout is `.hd-chart-ladder`, not previewed) and `src/components/HoldingChart.tsx`.
