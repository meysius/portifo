# WatchlistRow

One symbol on the Watchlist: the symbol over its company on the left, and on the right one line of its latest price, a bar of its move and the move itself, as a Stocks watchlist reads. Outside regular hours, once the symbol has traded since the close, the price is that trade's, marked with its session's glyph. In a search result, the same row carries an add mark instead of the price.

## When to use
On the Watchlist tab, one per watched symbol, in the order they were added (a new one joins the bottom). Tapping it pushes the symbol's page. Symbols are added as transactions are: the heading's 32px `IconButton` (+, "Add symbol") opens a search field under the heading, focused, with Cancel beside it, and the + steps aside until Cancel closes the search. While the field holds a query, the results are WatchlistRows with the add mark; tapping one adds the symbol, and tapping it again takes it off. With the field empty the list stays in view under it.

## What you provide
- The symbol, exactly as the market prices it, exchange suffix included ("SHOP.TO").
- The company: the quote's short name, or the search result's name until a quote arrives. In a search result, the name and the exchange, joined with a middle dot ("NVIDIA Corporation · NASDAQ").
- The price in the symbol's own currency ("$221.97"), never converted to the display currency, and that currency's code.
- Today's move as a percentage, "+2.54%". The signed change per share is on the symbol's page, not the row.
- Outside regular hours, when the symbol has traded since the close: the session, the price and its percentage from the close. These replace the regular price and today's move on the row. The session is "Pre-market" (4am–9:30am ET), "After hours" (4pm–8pm) or "Overnight" (8pm–4am, which only the live stream reports). Most US listings have one; other exchanges, crypto and FX don't.
- In a search result, whether the symbol is already on the list.
- Whether the symbol has an active price alert (see `PriceAlerts`).

## Rules
- Above the list, the ledger's count row: the number of symbols ("8 symbols") right-aligned in `row-meta` `ds-muted`, 10px block padding, over a 4px `ds-subtle` band. The list starts 4px below the band. Search results replace both and follow the field directly.
- Rows are at least 60px, with 10px padding and a 10px gap. No glyph on the left: the symbol is the row's identity.
- Symbol `--ds-fs-12` 600, line height 1.4; company `--ds-fs-9` `ds-secondary`, 3px below, line height 1.6. The company is the row's one line allowed to clip, on one line with an ellipsis, so every row stays two lines.
- A symbol with an active price alert ends its symbol line with a 12px bell in `ds-muted`, 5px from the symbol, and "price alert on" in the row's `aria-label`. A rule that has already fired doesn't count.
- The end column is one line, vertically centred, 10px between its parts: the price, the bar, the move. The bar and the move have fixed widths, so prices, bars and moves each line up down the list.
- The price is mono `--ds-fs-12` 400 in `ds-text`, without a currency sign, two places (four below 1). A symbol not priced in US dollars follows it with its code, `--ds-fs-8` `ds-muted`, 4px on ("201.23 CAD"). Outside regular hours a 14px glyph in `ds-secondary` sits 4px before it: a sun for pre-market, a crescent moon for after hours, a crescent moon and a star for overnight. The row's `aria-label` names the session ("Overnight $185.92 USD, +2.38% since the close").
- The bar is a 52 × 6px track in `ds-line`, radius 3px, with a 1px × 14px `ds-muted` tick at its centre. The move grows from the tick, right in `ds-positive` for a gain and left in `ds-negative` for a loss, 6px tall with round ends, at least 6px long (a dot). One scale for the list: half the track stands for the biggest move on it, or 1% when none reaches that, so a quiet day never fills. A move that rounds to 0.00% draws no bar.
- The move is mono `--ds-fs-11` 500, two places with its sign ("+1.92%", "−0.37%"), right-aligned in 7 characters, in gain/loss colour by the percentage as shown: one that rounds to 0.00% stays `ds-text`. Two places, not the app's usual one, because a watchlist is read for small moves. No pill on the row; the pill belongs to the symbol page's hero.
- Without a quote, the end column says "No price" in `--ds-fs-9` `ds-muted` (nothing while quotes are still loading).
- The add mark is a 32px square with a 9px radius: a + in `ds-accent` on `ds-accent-tint` while the symbol can be added, a bare ✓ in `ds-accent` once it is on the list. The whole row is the button, with `aria-pressed` and an `aria-label` that says what a tap does ("Add NVDA, NVIDIA Corporation, to watchlist").
- A row slides left to a Remove action (swipe it part way and tap Remove, or all the way across to remove it at once), as an iOS list does. Remove is 84px wide, `--ds-fs-11` 600 in `ds-bg` on `ds-negative`, full height, and meets the screen's edge: the list runs edge to edge and each row takes the gutter back. An open row closes at the next tap in the list, which does nothing else, when the page scrolls, and when the page is left. Taking a symbol off pauses its price alerts (see `PriceAlerts`). The symbol page's ✓ takes it off too, for anyone who doesn't swipe.
- Rows bleed 10px into the gutter on both sides so the press highlight (`ds-subtle`, radius 10px) is wider than the text. No rule between rows. No chevron.
- Under the list, the ledger's footer, centred `row-meta` `ds-muted`: "Prices in each symbol’s own currency." and "The same watchlist in every portfolio." (the list belongs to the person, not a portfolio).

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.wl-*`) and `src/pages/WatchlistPage.tsx`.
