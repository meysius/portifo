# Portifo connected-prototype audit & v2

## Scope and method

Audit target: `design-poc/poc.e2e.html`, including its four embedded studies, their 22 primary scenarios, and connected navigation. Source review plus Chromium browser exploration using agent-browser. The existing :5173 server serves the frontend package (the prototype URL falls back to the app), so prototypes are tested directly through `file://`. No server was started and no backend data was changed.

## Findings (recorded during audit)

### 01 · High — Empty ledger CTA is a dead end
Reproduction: Transactions → Your first transaction → Add your first transaction. No dialog opens. The header + uses a different handler, so onboarding and the populated page diverge.
Evidence: [empty ledger after clicking its CTA](screenshots/original-empty-ledger.png).
V2 requirement: one entry point for all four transaction types, shared by every CTA.

### 02 · High — Connected pages tell incompatible financial stories
Portfolio shows three accounts / $128,462.50 / 250 NVDA shares; Accounts shows six different accounts and different holdings; ledger purchases do not correspond to the purchase lots. NVDA's price varies by account when derived from position values. A connected walkthrough should not require users to remember which dataset they are in.
V2 requirement: one coherent in-memory model for accounts, purchases, cash, holdings and ledger; aggregate values derive from it. Sample scenarios must be explicitly identified.

### 03 · High — Actions do not complete the tracking loop
Buy/sell review only finishes a preview, with no ledger or balance update; account creation and cash edits only affect Accounts, not the portfolio. Cash deposit/withdrawal entry is absent from the connected shell. This prevents meaningful end-to-end testing.
V2 requirement: save records within the isolated demo, update balances and average-cost positions, disclose that no brokerage trade occurs, and distinguish balance corrections from cash movements.

### 04 · Medium — Financial context and sample date are buried
The portfolio headline and growth chart have no prominent USD/sample-date label. 'Growth' includes deposits and could be mistaken for investment return until the information sheet is opened. The ledger labels October 3, 2025 'Today' regardless of the actual date.
V2 requirement: explicit display currency and snapshot date, 'Value history' terminology, visible cash-flow disclaimer, absolute dates.

### 05 · Medium — Important state controls disappear in the connected prototype
Quote loading/unavailable and extreme gain/loss variants live in the child study's hidden rail and are not exposed by the shell. On mobile all scenario controls disappear.
V2 requirement: mobile-accessible preview tools, with separate quote loading/error and large-loss/large-gain states.

### 06 · Medium — Touch targets and secondary text are too small
30–32px close/add controls and 30px chart ranges are below the usual 44px touch-target recommendation. Much secondary content is 9–11px before scaling. Light muted text (#929baa on white) is approximately 2.8:1, below 4.5:1 for normal text.
V2 requirement: ≥44px interactive controls, readable captions, AA-contrast secondary text, obvious focus styles, 100–140% text scaling without shrinking amounts to 10px.

### 07 · Medium — Holding chart is pointer-only
Unlike the portfolio chart, holding price history has no keyboard inspection. External chart button is tiny; hover-only information is inaccessible on touch/keyboard.
V2 requirement: keyboard arrows/Home/End and pointer/touch inspection with a persistent accessible readout.

### 08 · Medium — Review has no edit step and fields omit accounting costs
Trade review cannot return to the filled form; fees are absent even though recorded transactions include them. Dates can be in the future relative to the illustrative snapshot, and oversized values are insufficiently bounded.
V2 requirement: edit/review/save progression preserving a draft, fees, precise quantity/amount bounds, account-specific sell limits and date validation.

### 09 · Medium — Navigation state is only partly in browser history
The shell records top-level pages, while account details, purchase details and child dialogs mutate private frame state. Browser Back does not uniformly mean one visible step back. Returning from a purchase resets holding scroll; filters and scenario state can be unexpectedly reset by new entry links.
V2 requirement: route stack for nested pages and dialogs, exact origin restoration, preserved root-tab scroll and ledger filters, valid deep links.

### 10 · Medium — Modal isolation is inconsistent
Shell dialogs inert the viewport and left rail, but not the journey controls on the right. Child dialogs cannot isolate the outer workbench. Changing scenarios or journeys can abandon a filled form with no warning.
V2 requirement: one dialog manager, all background content inert, focus containment/restoration, Escape/backdrop/browser-Back consistency, unsaved-draft confirmation.

### 11 · Medium — Closed positions stop at a read-only summary
Closed portfolio rows open a summary sheet instead of the connected closed-holding page. Sales links from account-expanded holding history lose the account/type scope in the bridge.
V2 requirement: closed positions connect to full holding/sale history, and holding→ledger links preserve symbol + account + type.

### 12 · Low — The workbench competes with the product
Two sets of navigation and long journey copy make the desktop study feel like a collection of samples rather than an app. The 390px frame overflows awkwardly near tablet breakpoints and remains fixed-height even on shorter desktops. Reset reloads without confirming loss of temporary edits.
V2 requirement: quieter editorial workbench, clear demo boundary, adaptive frame, intentional reset confirmation, and one app-level navigation system.

## V2 implementation and validation

Pending implementation and regression run. Original study files remain unchanged.
