# Screen anatomy

Every Portifo screen is one of four kinds. Build a new screen by picking its kind and stacking the parts below in this order. The component cards show each part.

## Tab root

Portfolio, Transactions, Accounts, Settings. The tab bar is visible.

1. **Page heading** (`PageHeading`). The title in `page-title`, 16px below the status bar (`calc(16px + safe-area-top)`), on the gutter. At most one trailing control: a 32px `IconButton` for the screen's add action (Transactions, Accounts), or the title itself as a switcher with a muted `chevron-down` (Portfolio's name switches portfolios). No back link, no bar, no hairline at rest.
2. **Sticky bar** (`StickyBar`). Absent at rest. Once the heading has scrolled under the top edge, a 50px `ds-bg` bar fades in with the same title centred in `bar-title` over a `ds-line` hairline. It has no buttons.
3. **Hero** (`Hero`), when the screen has a headline figure: label, figure, return.
4. **Sections** (`Section`), each starting with the 6px `ds-subtle` band and an h2 in `section-title` with optional `meta` on the right.
5. **Footer note**, centred `row-meta` in `ds-muted`, saying what the numbers are ("All amounts in USD · Average-cost accounting").
6. **Tab bar** (`TabBar`). Four tabs, always in this order: Portfolio, Transactions, Accounts, Settings.

Tab roots support pull to refresh.

## Pushed page

A holding, an account, the cash: anything opened from a row with a right chevron. The tab bar is hidden for as long as the pushed page is on screen.

1. **Back bar** (`BackBar`). 50px, opaque `ds-bg`. On the left, the Back link: a 22px chevron and the **tab's** name ("Portfolio", "Accounts"), in `back-link` and `ds-accent`, at most 140px wide. Never a bare chevron, and never the word "Back". On the right, at most one quiet `IconButton` (Rename). At rest the bar has no title and no hairline; once the large heading scrolls under it, the title fades in centred in `bar-title` and the `ds-line` hairline appears. Collapsed, it matches the sticky bar.
2. **Page heading** under the bar, 12px down: the page title in `page-title` (a symbol, an account name), then one subtitle line in `ds-secondary` joined with middle dots ("3 holdings · Manually tracked" on an account; the company name · its exchange on a holding).
3. **Hero**, then **Sections**, then a **footer note**, as on a tab root.
4. **Bottom actions** (`BottomActions`), only where the page has a main pair of actions: Buy and Sell sit where the tab bar was, in thumb reach.

## Full-screen task

Creating something that needs more than one field: a new account, the add-transaction wizard. It covers the tabs completely.

1. **Top bar**, 52px, `ds-line` hairline below: Cancel on the left (`ds-secondary`, never accent), the task's name centred in `task-bar-title`, and a 40px spacer on the right to keep the title centred.
2. **Body**, scrolling: an eyebrow kicker in `ds-accent`, the question in `form-title`, one intro sentence in `ds-secondary`, then the fields.
3. **Footer**, pinned, with a `ds-line` hairline above: the one `ds-action`, and an optional single line of fine print under it.

## Bottom sheet

Anything quick: picking one option, a short form (Rename account, Set cash balance), the details of one record.

1. **Grabber**, 34×4px `ds-line`, centred.
2. **Header**: the sheet's title in `sheet-title` on the left; a 30px round close button (`ds-secondary` × on `ds-subtle`) on the right. Title it with what you are choosing or doing: "Filter by type", "Display currency", "Rename account".
3. **Content**, choosing from one of:
   - a list of options with a radio mark, a description and a count that apply on tap and close the sheet (`OptionList`);
   - a grid of short options that apply on tap and close the sheet (`OptionGrid`);
   - fields, notices and one `ds-action` (`Field`, `Button`);
   - a figure and label/value rows describing one record (`DetailRows`).
4. Notices (`ds-sheet-notice`) go above or below the content, in `body-help` and `ds-secondary`. They explain what the change does, not how to use the control.

The sheet's ground is `ds-bg` with 22px top corners and a 40% black backdrop. It is as tall as its content, up to 90% of the screen, and then scrolls.

## Headers at a glance

| | Tab root | Pushed page | Full-screen task | Sheet |
| --- | --- | --- | --- | --- |
| Top-left | Nothing | Back + tab name | Cancel | Nothing |
| Title at rest | Large heading | Large heading under the bar | Centred in the bar | Left, sheet title |
| Title when scrolled | Sticky bar, centred | Back bar, centred | Same | Same |
| Hairline | Only when scrolled | Only when scrolled | Always | None |
| Trailing control | One icon button or switcher | One quiet icon button | Spacer | Close |
| Tab bar | Shown | Hidden (Buy/Sell may take its place) | Covered | Covered by the backdrop |
