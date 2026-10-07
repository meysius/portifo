# OptionGrid

A sheet's grid of short options that apply as soon as one is tapped.

## When to use
Picking one short code from a small set where no explanation is needed: the display currency. Tapping applies the choice and closes the sheet, so there is no confirm button.

## What you provide
The options (three- or four-letter codes), the current one, and a notice above and below saying what the choice affects.

## Rules
- Four equal columns, 6px gap.
- Each tile: 12px × 5px padding, radius 7px, `--ds-fs-11`, `ds-secondary` on `ds-subtle`.
- The current tile is `ds-accent` on `ds-accent-tint`, and `aria-pressed="true"`.
- Notices explain the effect: "Totals and investments are converted to this currency across the app. Cash balances stay in their original currency." and "Converted at today’s exchange rates."

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.ds-sheet-options`, `.ds-sheet-option`).
