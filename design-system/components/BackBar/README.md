# BackBar

A pushed page's top bar: the Back link on the left, the page title fading in at the centre once you scroll.

## When to use
On every page pushed from a row (a holding, an account). Never on a tab root, a full-screen task or a sheet.

## What you provide
- The tab's name for the Back label (`tabLabel` from `TabBaseContext`: "Portfolio", "Transactions", "Accounts", "Settings").
- The page title, the same string as the large heading under the bar.
- Optionally one quiet `IconButton` on the right (Rename account).

## Rules
- Back = a 22px chevron (2px stroke) plus the tab's name, in `ds-accent`, `back-link` (Public Sans 400, `--ds-fs-15`), at most 140px wide. Never a bare chevron and never the word "Back".
- 50px tall plus the safe-area inset, opaque `ds-bg`, no blur. Inset 13px on the left (the chevron's own padding does the rest) and 19px on the right.
- At rest the centre is empty and there is no hairline. Once the large heading has scrolled under the bar, the title fades in (0.18s) in `bar-title` and the `ds-line` hairline appears. Collapsed, it matches the `StickyBar`.
- The trailing control is quiet (`ds-secondary`, no fill). Put the page's main actions in the content or in `BottomActions`, not here.
- The tab bar is hidden while a pushed page is showing.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.hd-page ion-header`, `.ac-detail-header`) and `src/lib/backIcon.ts`.
