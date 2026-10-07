# PageHeading

The large page title that starts every screen, with at most one control beside it.

## When to use
At the top of every tab root, and directly under the Back bar on a pushed page. It is the only place the page's name appears at rest.

## What you provide
- The title: the tab's name on a tab root ("Transactions", "Accounts"), or the thing's own name on a pushed page ("NVDA", "Joint brokerage").
- Optionally one trailing control:
  - a 32px `IconButton` for the screen's add action, labelled for screen readers ("Add transaction", "Add account");
  - or, on Portfolio, the title itself as a button with a 16px muted `chevron-down`: tapping the portfolio's name switches portfolios.
- On a pushed page, optionally one subtitle line under the title.

## Rules
- Title in `page-title`: Inter 650, `--ds-fs-23` (27.6px), −0.8px, line-height 1.2 (1.25 on an account). Long names wrap; they never shrink or truncate.
- On a tab root the heading clears the status bar itself: `padding-top: calc(16px + safe-area-top)`. Under a Back bar it starts 12px down.
- Side padding is `ds-gutter`; heading and control are vertically centred with a 8–10px gap.
- The subtitle is one line of facts joined with middle dots, in `ds-secondary`: an account's "3 holdings · Manually tracked" (`--ds-fs-10`, 6px under the title) or a holding's company and exchange (`--ds-fs-12`, 4px under, dots in `ds-muted`).
- No eyebrow above the title, no date, no greeting.
- The heading is what the `StickyBar` or `BackBar` title replaces once it scrolls away; keep the two strings identical.

## Drift
The two subtitles use different sizes (12px account, 14.4px holding). Pick one when either screen is next touched.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.po-heading`, `.tl-heading`, `.ac-heading`, `.ac-subtitle`, `.hd-company`).
