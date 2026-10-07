# OptionList

A sheet's list of options to pick one from, each with a description and how many records it matches.

## When to use
Picking one value where each option needs a word of explanation or a count: Transactions' symbol, type and account filters. For a handful of short codes, use `OptionGrid`.

## What you provide
- One intro sentence under the title: "Choose the kind of move you want to see."
- The options, starting with the "all" option ("All types · Trades & cash movements", "All symbols · Includes cash movements", "All accounts · Your complete portfolio"), each with a title, a one-line description and a count.
- For long lists (symbols), a search field above the options, and an empty message when nothing matches ("No symbols found. Try a ticker or company name.").
- The confirm button's label, which states the result: "Show 12 records".

## Rules
- Intro in `--ds-fs-11`, line-height 1.7, `ds-secondary`, pulled 6px up under the header and 16px above the list.
- Options are at least 55px: 13px × 11px padding, radius 10px, 5px apart, an 11px gap. A native radio (17px, `accent-color: ds-accent`) leads; the count trails in mono `--ds-fs-10` `ds-muted`.
- Title `--ds-fs-12` 550; description `--ds-fs-9` `ds-secondary`, 4px below.
- The chosen option gets a `ds-accent` border on `ds-accent-tint`. Others have no border or fill.
- The list scrolls inside the sheet (at most 360px or 43% of the screen); the confirm button stays below it, separated by a `ds-line` hairline with 14px either side.
- Choosing doesn't apply anything until the button is pressed; the button's count updates as the choice changes.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.tl-filter-intro`, `.tl-filter-option*`, `.tl-filter-apply`, `.tl-search-field`).
