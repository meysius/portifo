# Hero

A screen's one headline amount: a label, the figure, and how it has moved.

## When to use
Once per screen, directly under the page heading, when the screen is about one amount: the portfolio's total, a holding's position value, an account's total, a watched symbol's share price, a transaction in its sheet. A screen without a single headline amount has no hero.

## What you provide
- A label naming the figure, with its currency when it isn't obvious: "Total portfolio value", "Position value · USD", "Total account value", "Realized gain · USD", "Share price · CAD".
- The figure, formatted with the display currency.
- Optionally the return: a signed amount, its percentage in a `ReturnPill`, and what it measures ("Today", "Unrealized return", "Return on sold shares"). On a watched symbol, "Today" is the move per share.
- Optionally a second return in the same form. A holding shows two: "Today", then "Unrealized return".
- Optionally a badge in the label ("Closed"), a loading spinner ("Loading prices"), or a currency chip that opens the display-currency sheet.

## Rules
- Label in `hero-label` (`--ds-fs-12`, `ds-secondary`), 9px above the figure.
- Figure in `hero-figure`: mono 500, `--ds-fs-27`, −1.2px, line-height 1.25, in `ds-text`. It takes gain/loss colour only when the figure is itself a return (a closed holding's realized gain or loss).
- Portfolio and holding figures stay on one line: a long one shrinks a pixel at a time until it fits, never below 22px. An account total wraps instead (`font-size: min(var(--ds-fs-27), 9vw)`).
- Return line 10px below, items 8px apart: signed amount in `ds-positive`/`ds-negative`, then the percentage on its tint, then the label in `--ds-fs-10` `ds-secondary`. The label comes last on every screen.
- Two returns are rows of one grid (`auto auto 1fr`, 8px gaps), so the amounts, pills and labels each line up in a column. Today goes first, directly under the figure as on Portfolio, then the longer span. Both rows look the same; never demote one to a smaller line or drop its pill.
- A percentage appears once. Today's move on a holding is shown on the shares held, in the hero; the share price beside the title doesn't repeat it.
- `ReturnPill`: mono `--ds-fs-10`, padding 3px 5px, radius 4px, on `ds-positive-bg` / `ds-negative-bg` (`ds-subtle` when flat).
- Badge: `--ds-fs-10`, padding 3px 6px, radius 4px, `ds-secondary` on `ds-subtle`.
- Currency chip: 32px tall, padding 7px 9px, radius 7px, `--ds-fs-10` `ds-secondary` on `ds-subtle`, with a 12px `chevron-down` (it opens a sheet).
- When the value can't be computed, replace the figure with a sentence in Inter 550 at the same size ("Getting the latest quote…", "Value unavailable") and a `body-help` line saying what is known.

## Drift
Hero padding differs per screen: Portfolio 18px top, Holding 27px / 21px, Account 24px / 23px.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.po-hero*`, `.hd-hero*` including `.hd-hero-returns`, `.hd-pill`, `.hd-badge`, `.ac-hero*`, `.ac-currency-chip`).
