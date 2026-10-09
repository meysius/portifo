# OptionList

A sheet's list of options to pick one from, each with a description and how many records it matches. Tapping an option applies it and closes the sheet.

## When to use
Picking one value where each option needs a word of explanation or a count: Transactions' symbol, type and account filters. For a handful of short codes, use `OptionGrid`.

There is no confirm button. Each option already shows its count, and a filter is undone by picking again, so a second tap would add nothing. If a list ever needs several picks at once (multi-select), or the choice is hard to undo, it needs a different component with one `Button` stating the result.

## What you provide
- One intro sentence under the title: "Choose the kind of move you want to see."
- The options, starting with the "all" option ("All types · Trades & cash movements", "All symbols · Includes cash movements", "All accounts · Your complete portfolio"), each with a title, a one-line description and a count.
- For long lists (symbols), a search field above the options, and an empty message when nothing matches ("No symbols found. Try a ticker or company name.").

## Rules
- Intro in `--ds-fs-11`, line-height 1.7, `ds-secondary`, pulled 6px up under the header and 12px above the list.
- Options are full-width buttons, at least 44px (52px with a description): 8px × 11px padding, radius 10px, 3px apart, a 10px gap. A 17px radio mark leads (a 1.5px `ds-muted` ring; chosen, a `ds-accent` ring around a 9px `ds-accent` dot); the count trails in mono `--ds-fs-10` `ds-muted`.
- Title `--ds-fs-12` 550; description `--ds-fs-9`, line-height 1.4, `ds-secondary`, 2px below.
- The chosen option gets a `ds-accent` border on `ds-accent-tint` and `aria-pressed="true"`. Others have no border or fill, and turn `ds-subtle` while pressed.
- The list scrolls inside the sheet (at most 360px or 43% of the screen), so the search field stays in view.
- Tapping an option applies it and closes the sheet. Reopening shows the current choice. The mark is drawn, not a native radio, so arrow keys never apply a choice by accident.
- Focus: the usual 3px `ds-focus` outline, but drawn inside the option (offset −3px), because the scrolling list would clip it outside.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.tl-filter-intro`, `.tl-filter-option*`, `.tl-search-field`).
