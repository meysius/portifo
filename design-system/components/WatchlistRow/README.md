# WatchlistRow

One symbol on the Watchlist, on the Transactions ledger's metrics: the symbol over its company on the left, the price and today's move over a line of fine print on the right. Two lines whatever the hour; outside regular hours the fine print carries the pre-market, after-hours or overnight price. In a search result, the same row carries an add mark instead of the price.

## When to use
On the Watchlist tab, one per watched symbol, in the order they were added (a new one joins the bottom). Tapping it pushes the symbol's page. While the search field holds a query, the results are WatchlistRows with the add mark; tapping one adds the symbol, and tapping it again takes it off.

## What you provide
- The symbol, exactly as the market prices it, exchange suffix included ("SHOP.TO").
- The company: the quote's short name, or the search result's name until a quote arrives. In a search result, the name and the exchange, joined with a middle dot ("NVIDIA Corporation · NASDAQ").
- The price in the symbol's own currency ("$221.97"), never converted to the display currency, and that currency's code.
- Today's move as a percentage, "+2.5%". The signed change per share is on the symbol's page, not the row.
- Outside regular hours, when the symbol has traded since the close: the session, the price and its percentage from the close. The session is "Pre-market" (4am–9:30am ET), "After hours" (4pm–8pm) or "Overnight" (8pm–4am, which only the live stream reports). Most US listings have one; other exchanges, crypto and FX don't.
- In a search result, whether the symbol is already on the list.
- Whether the symbol has an active price alert (see `PriceAlerts`).

## Rules
- Above the list, the ledger's count row: the number of symbols ("8 symbols") right-aligned in `row-meta` `ds-muted`, 10px block padding, over a 4px `ds-subtle` band. The list starts 4px below the band. Search results replace both and follow the field directly.
- Rows are the ledger's: at least 60px, 10px padding, a 10px gap. No glyph on the left: the symbol is the row's identity.
- Symbol `--ds-fs-12` 600, line height 1.4; company `--ds-fs-9` `ds-secondary`, 3px below, line height 1.6. The company is the row's one line allowed to clip, on one line with an ellipsis, so every row stays two lines.
- A symbol with an active price alert ends its symbol line with a 12px bell in `ds-muted`, 5px from the symbol, and "price alert on" in the row's `aria-label`. A rule that has already fired doesn't count.
- The end column is right-aligned, at most 65% of the row. Its first line is the price, mono `--ds-fs-11` 500 in `ds-text` (the ledger's amount), then today's move 7px after it on the same baseline, mono `--ds-fs-10` in gain/loss colour by the percentage as shown: a move that rounds to 0.0% stays `ds-text`. No pill on the row; the pill belongs to the symbol page's hero.
- Its second line is fine print, 3px below, `--ds-fs-9` `ds-muted`: the currency code ("USD", "CAD"), on every row, because "$" alone is US, Canadian or Australian dollars. Outside regular hours it continues after a middle dot with the session ("Overnight"), its price mono in `ds-secondary` and its percentage mono in gain/loss colour by the same rule, 4px apart: "USD · Overnight $185.92 +2.4%". It wraps rather than clips. The first line stays the regular session's, so it never changes meaning.
- Without a quote, the end column says "No price" in `--ds-fs-9` `ds-muted` (nothing while quotes are still loading).
- The add mark is a 32px square with a 9px radius: a + in `ds-accent` on `ds-accent-tint` while the symbol can be added, a bare ✓ in `ds-accent` once it is on the list. The whole row is the button, with `aria-pressed` and an `aria-label` that says what a tap does ("Add NVDA, NVIDIA Corporation, to watchlist").
- Rows bleed 10px into the gutter on both sides so the press highlight (`ds-subtle`) is wider than the text. One `ds-line` hairline under each row; none under the last. No chevron.
- Under the list, the ledger's footer, centred `row-meta` `ds-muted`: "Prices in each symbol’s own currency." and "The same watchlist in every portfolio." (the list belongs to the person, not a portfolio).

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.wl-*`) and `src/pages/WatchlistPage.tsx`.
