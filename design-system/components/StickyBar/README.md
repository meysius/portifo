# StickyBar

The bar that takes over a tab root's title once the page heading scrolls away.

## When to use
On every tab root. Pushed pages get the same look from their `BackBar` when it collapses, so the top of every scrolled screen reads the same.

## What you provide
The page title, identical to the `PageHeading` text, and a flag for whether the heading has scrolled away (`useHeadingScrolledAway`).

## Rules
- Absent at rest: opacity 0 and no pointer events, so the heading starts at the very top.
- Shown once the heading's bottom edge passes the top of the content: fades in over 0.18s (no fade with reduced motion).
- 50px tall plus the safe-area inset, opaque `ds-bg`, closed by a `ds-line` hairline drawn inside its height (`box-shadow: inset 0 -1px`).
- Title only, centred, in `bar-title` (Inter 600, `--ds-fs-16`). No buttons, no back link, no subtitle, no blur.
- It repeats the heading, so it is `aria-hidden`.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.ds-sticky-bar`) and `src/components/StickyTitleBar.tsx`.
