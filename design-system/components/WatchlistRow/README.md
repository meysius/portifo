# WatchlistRow

One symbol on the Watchlist, read across: the symbol and company, a line of its trading day, then its price and today's move. Outside regular hours it adds the pre-market, after-hours or overnight price. In a search result, the same row carries an add mark instead of the line and price.

## When to use
On the Watchlist tab, one per watched symbol, in the order they were added (a new one joins the bottom). Tapping it pushes the symbol's page. While the search field holds a query, the results are WatchlistRows with the add mark; tapping one adds the symbol, and tapping it again takes it off.

## What you provide
- The symbol, exactly as the market prices it, exchange suffix included ("SHOP.TO").
- The company: the quote's short name, or the search result's name until a quote arrives. In a search result, the name and the exchange, joined with a middle dot ("NVIDIA Corporation · NASDAQ").
- The day's line: the latest trading day's 5-minute closes (`GET /market/sparks`), with the regular session's open and close and the span to draw it across.
- The price in the symbol's own currency, with that currency's code beside it ("USD", then "$221.97"). Never converted to the display currency.
- Today's move as a percentage, "+2.5%". The signed change per share is on the symbol's page, not the row.
- Outside regular hours, when the symbol has traded since the close: the session, the price and its percentage from the close, "After hours $220.47 −0.7%". The session is "Pre-market" (4am–9:30am ET), "After hours" (4pm–8pm) or "Overnight" (8pm–4am, which only the live stream reports). Most US listings have one; other exchanges, crypto and FX don't, and their rows stay two lines.
- In a search result, whether the symbol is already on the list.
- Whether the symbol has an active price alert (see `PriceAlerts`).

## Rules
- The list is one grid of three columns: identity (the rest of the width), the line (64px), the price (as wide as the widest price). Each row takes its columns from the list (CSS subgrid), so the lines stand in one column down the list, 14px from their neighbours. Line 1 is the symbol and the price, line 2 the company and today's move, each pair on a shared baseline. The line spans both, centred.
- Portfolio's holding-row metrics: 15px block padding, no glyph on the left. The symbol is the row's identity.
- Symbol `--ds-fs-12` 600; company `--ds-fs-9` `ds-secondary`, 5px below. A long company name wraps; nothing on the row clips.
- A symbol with an active price alert ends its symbol line with a 12px bell in `ds-muted`, 5px from the symbol, and "price alert on" in the row's `aria-label`. A rule that has already fired doesn't count.
- Price mono `--ds-fs-12` 500 in `ds-text`. The currency code sits before it, 5px apart on the same baseline, in `--ds-fs-9` 500 `ds-muted`, on every row: "$" alone is US, Canadian or Australian dollars.
- Today's move mono `--ds-fs-10` 500, 5px below the price, in gain/loss colour by the percentage as shown: a move that rounds to 0.0% stays `ds-text`. No pill on the row; the pill belongs to the symbol page's hero.
- The line is 64 × 30px: the day in `ds-text`, 1.5px, round joins, ending in a 2px dot. Behind it, a 1px dashed (2 2) `ds-muted` line across the full width at the price today's move is measured from (the previous close; for crypto, Yahoo's own 24-hour reference). The scale takes in the day and that price, with 3px to spare top and bottom, so where the line ends against the dashes says up or down. The line is ink, never gain/loss colour: the percentage beside it already says how it went, and a bad day shouldn't turn the list into a wall of red.
- The line sits on its day's own clock, from the session's start to its end. Mid-session it stops at the latest trade, and every symbol of one market stops at the same place down the list. After the close it fills the width. With Extended hours on (the charts' setting, one per device), the day runs from the pre-market's start to the after-hours close, faded to 40% outside the regular session as the 1D chart draws it. The latest overnight trade is one more point past 8 PM: Yahoo's chart has no overnight bars. A market that never closes (crypto, FX) shows its last 24 hours. A market with its own hours (Toronto, London) sits on its own session.
- The line runs on to the latest trade as the quote streams in. It is fetched when the list opens, on every visit and pull to refresh, and every five minutes while a listed market trades. A regular trade past the day's end belongs to the next session, so it waits for the next fetch. Until a line arrives, or if Yahoo has no chart for the symbol, the column stays empty.
- The pre-market, after-hours or overnight line sits on a third line, 7px below, under the line and the price, right-aligned, in `--ds-fs-9`: "Pre-market", "After hours" or "Overnight" in `ds-secondary`, the price mono `ds-text`, the percentage mono in gain/loss colour by the same rule, 5px apart. The currency code isn't repeated; it is two lines up on the same row. It wraps rather than clips. The main price and today's move stay the regular session's, so the row's top two lines never change meaning.
- Without a quote, the price column says "No price" in `--ds-fs-9` `ds-muted`, centred on the two lines (nothing while quotes are still loading).
- The add mark is a 32px square with a 9px radius: a + in `ds-accent` on `ds-accent-tint` while the symbol can be added, a bare ✓ in `ds-accent` once it is on the list. The whole row is the button, with `aria-pressed` and an `aria-label` that says what a tap does ("Add NVDA, NVIDIA Corporation, to watchlist"). A search result has no line and no price: identity on the left, the mark on the right, 11px apart.
- Rows bleed 10px into the gutter on both sides so the press highlight (`ds-subtle`) is wider than the text. One `ds-line` hairline under each row; none under the last. No chevron, and no caption above the list: the line and the figures speak for themselves.
- Under the list, a footer note: "The dashed line is the previous close", "Prices in each symbol’s own currency" and "The same watchlist in every portfolio" (the list belongs to the person, not a portfolio).

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.wl-*`), `src/pages/WatchlistPage.tsx` and `src/components/WatchSpark.tsx`.
