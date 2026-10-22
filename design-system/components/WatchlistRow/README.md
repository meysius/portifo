# WatchlistRow

One symbol on the Watchlist: the symbol and company, then its price and today's move. The same row in a search result carries an add mark instead of a price.

## When to use
On the Watchlist tab, one per watched symbol, in the order they were added (a new one joins the bottom). Tapping it pushes the symbol's page. While the search field holds a query, the results are WatchlistRows with the add mark; tapping one adds the symbol, and tapping it again takes it off.

## What you provide
- The symbol, exactly as the market prices it, exchange suffix included ("SHOP.TO").
- The company: the quote's short name, or the search result's name until a quote arrives. In a search result, the name and the exchange, joined with a middle dot ("NVIDIA Corporation · NASDAQ").
- The price in the symbol's own currency, with that currency's code beside it ("USD", then "$221.97"). Never converted to the display currency.
- Today's move: the signed change per share and its percentage, "+$5.50 · +2.5%".
- In a search result, whether the symbol is already on the list.

## Rules
- A caption above the list names the two columns: "Symbol / company" and "Price / today", in `row-meta` `ds-muted`.
- Portfolio's holding-row metrics: 15px block padding, 11px gap, no glyph on the left. The symbol is the row's identity.
- Symbol `--ds-fs-12` 600; company `--ds-fs-9` `ds-secondary`, 5px below. A long company name wraps; nothing on the row clips.
- Price mono `--ds-fs-12` 500 in `ds-text`. The currency code sits before it, 5px apart on the same baseline, in `--ds-fs-9` 500 `ds-muted`, on every row: "$" alone is US, Canadian or Australian dollars.
- Today's move mono `--ds-fs-9`, 6px below the price, in gain/loss colour by the percentage as shown: a move that rounds to 0.0% stays `ds-text`. No pill on the row; the pill belongs to the symbol page's hero.
- Without a quote, the end column says "No price" in `--ds-fs-9` `ds-muted` (nothing while quotes are still loading).
- The add mark is a 32px square with a 9px radius: a + in `ds-accent` on `ds-accent-tint` while the symbol can be added, a bare ✓ in `ds-accent` once it is on the list. The whole row is the button, with `aria-pressed` and an `aria-label` that says what a tap does ("Add NVDA, NVIDIA Corporation, to watchlist").
- Rows bleed 10px into the gutter on both sides so the press highlight (`ds-subtle`) is wider than the text. One `ds-line` hairline under each row; none under the last. No chevron.
- Under the list, a footer note: "Prices in each symbol’s own currency" and "The same watchlist in every portfolio" (the list belongs to the person, not a portfolio).

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.wl-*`) and `src/pages/WatchlistPage.tsx`.
