# PriceAlerts

A watched symbol's alert rules: a section on its page listing each one, and the sheet that adds, edits or deletes one.

## When to use
On a watched symbol's page, between the chart and "Latest session". An alert fires when the price crosses a level the person chose, and arrives as a notification on their phone. Holdings have no alerts: the rules belong to the Watchlist.

## What you provide
- For each rule, its direction ("Crosses below" or "Crosses above") and its price in the symbol's own currency, with that currency's code beside it ("USD", then "$190.00").
- Its status: "Active"; "Went off Oct 30 at $199.40" once it has fired; "Paused" while the symbol is off the watchlist.
- With no rules yet, one sentence saying what an alert does: "Get a notification when NVDA crosses a price you choose."
- When an alert can't reach this device, one sentence saying why: "Notifications are off on this device." with a "Turn on notifications" text action; "Notifications are blocked for Portifo. Allow them in your device’s settings to get these alerts."; or "To get these on your phone, add Portifo to your Home Screen and open it from there."

## Rules
- A `Section` titled "Price alerts", with "Add alert" as a text action where the meta would go. There is no primary button: `Section` doesn't allow one.
- A rule's row: 13px block padding, 11px gap, full-bleed like every row, one `ds-line` hairline between rows. Direction `--ds-fs-12` 500; status `--ds-fs-9` `ds-secondary`, 5px below; the price mono `--ds-fs-12` 500 with its code in `--ds-fs-9` `ds-muted`, as on a `WatchlistRow`. Active rules come first. No chevron. The whole row opens the sheet.
- A rule's target shows every decimal it needs, 2 at least, up to 4 (8 under $1): "$1.0845", "$0.00012345", not the usual two. Rounding a target would misstate the rule. A traded price (the current one, or the one that set a rule off) keeps that precision only under $10, and shows cents above it: "$204.55", not "$204.547".
- A rule fires once, then stays listed as the record of when it went off. It doesn't fire again by itself: a price sitting on a level would notify every few minutes.
- A rule watches the latest trade, after-hours and pre-market included, and the sheet quotes that same price: "NVDA is at $220.47 USD after hours."
- "Crosses" means crossing. A rule set below a price that's already lower can't fire until the price has been above it. The sheet says so as soon as the price is typed: "NVDA is already below this price. You’ll be notified if it rises above it and falls back."
- The sheet is a `Sheet` form titled "New NVDA alert" or "Edit NVDA alert": two direction tiles (`OptionGrid`'s tile, in two columns; they don't apply or close anything, the button does), the price `Field` labelled "Price per share · USD" with a decimal keypad, and a notice with the current price and what will happen.
- Its one `Button` says what happens: "Create alert", "Save alert", or "Turn alert back on" for a rule that has fired. Saving always starts the rule over. Deleting is a text action under it, in `ds-accent` like any other: no red, no confirmation. A rule is quick to set again, and a toast confirms it.
- The notification's title states the rule and its body the price: "NVDA crossed below $200.00", "Now $199.40 USD · After hours". Tapping it opens the symbol's page.
- Taking a symbol off the watchlist pauses its rules rather than deleting them, because that ✓ is one tap with no confirmation. "Add alert" goes away and a note says "Paused while NVDA is off your watchlist."; putting the symbol back resumes them.
- A symbol with an active rule gets a bell on its `WatchlistRow`.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.wl-alert*`) and `src/components/PriceAlerts.tsx`.
