# Expense tracking (design POC)

Implemented in `design-poc/expenses.html`. This is a clickable study, not a shipped app screen. It reuses the existing tokens and components; there are no new colour or typography tokens.

## Entry and screen anatomy

Spending is a **pushed page from Transactions**, not a fifth tab. Use BackBar labelled “Transactions”, PageHeading, Hero, Section and a footer explaining the figures. The existing four-tab order stays unchanged. Category detail is another pushed view with the same anatomy. No tab bar appears in either view.

The heading’s one IconButton opens “Import statement”. Import is a two-step **TaskScreen** covering the underlying page. Cancel returns to Spending without importing. Each step has only one primary action in its pinned footer. Picking a month or category uses a **Sheet / OptionList**: tapping an option applies it and closes; there is no confirm button.

## Spending figures

- Spending is purchases **minus refunds**, not the card balance or the statement’s amount due.
- Repayments and transfers are excluded so they don’t count as spending twice.
- Amounts, shares of spending and changes use the mono face and tabular figures.
- Higher spending is neither a realized loss nor an investment return. All totals and comparisons use neutral ink; changes use a neutral pill on `ds-subtle`, never gain/loss colours.
- Month-over-month change shows both the signed money difference and a signed percentage, with the comparison month written out.
- A partial month shows the date range and “Partial month, not compared”. It must not compare a few days of expenses against a complete month.
- A category with more refunds than purchases shows a negative net amount and “Net refunds”, not a negative share-of-spending progress bar.

## Category marks and rows

Expense categories reuse the breakdown mark palette with **stable identities across months**: Food & drink → `ds-hold-1`, Groceries → `ds-hold-2`, Shopping → `ds-hold-3`, Transport → `ds-hold-4`, Subscriptions → `ds-hold-5`, Other → `ds-hold-other`. This is an expense-specific extension: holdings still assign hues by rank. Never reshuffle expense hues when their amounts change; that would make category trends misleading.

Colour is only on a dot, sparkline, progress mark or chart bar, always beside a text label. The row itself and its amount remain neutral. Category rows are whole-row buttons, bleed 10px into each gutter, have one hairline below, and show a right chevron because they push category detail. Each row has a name, share of total (or “Net refunds”), amount, and monthly change. The decorative sparkline is hidden from assistive technology; the button’s accessible name includes the exact amount and change.

## Monthly chart

Six month buttons, with labels under the bars. Muted breakdown marks show context; the selected month is accent on the total-spending chart, and the category’s stable hue on category detail. Geometry does not scale with type. Every bar has an accessible month, year, amount and partial-month status. Selecting a bar updates the hero, comparison, insight and category/record list. The selected amount is also written below the chart.

When category net spending is negative, bars extend below a visible zero baseline. Do not silently clamp refunds to zero. Sparklines give the six-month shape; exact values are available in category detail.

## Import review

- One file, one card account, then a review of the detected statement period and net spending.
- Low-confidence merchants must be confirmed before import. Suggested category controls are tinted actions with a down chevron. A confirmed category becomes a neutral recessed control with a check mark and can still be changed.
- “View all records” includes excluded repayments and refund details, not just purchases. Each included purchase can be recategorized before import.
- Explain repayment exclusion and refund treatment alongside the totals.
- Imported records retain their source statement in record detail.
- Block re-importing the same statement; explain what happened rather than silently adding duplicates.
- Keep expense records separate from portfolio trades and account cash balances. Explain this in the task and success state.

## Prototype boundaries

File selection, file-type/size validation, category selection, in-memory import and subsequent charts are interactive. PDF extraction is simulated: no bytes are read and no file is uploaded, stored or processed. Every selected PDF uses the same fictional April records. Duplicates are blocked at this **sample-statement** level only. Actual parsing, document security, cross-statement overlap detection and persistence are future implementation work.
