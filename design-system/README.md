Portifo is a portfolio tracker for one person's investments and cash across accounts and currencies, used as an iPhone home-screen web app. Screens are flat and quiet: a white (or deep slate) ground, one hairline per edge, cobalt for anything you can act on, and green or red only when money was actually gained or lost. Every number you compare is set in a monospaced face so columns line up.

The running app (`packages/portifo-web`) is the source of truth. The values here are copied from `src/theme/ds.css` and `src/index.css`; when they disagree, the code wins and this system should be re-synced.

## Principles

- **Flat, one edge each.** No shadows, no blur, no cards with borders. A surface ends in a single `ds-line` hairline, and page sections are separated by a 6px band of `ds-subtle`. Bars are opaque `ds-bg`, never translucent.
- **Colour has a job, and only one.** `ds-accent` means "you can tap this". `ds-positive` and `ds-negative` mean a return went up or down. A Sell or a Withdraw is never red: money leaving is not a loss, so they get their own hues (`ds-sell`, `ds-withdraw`). Cash is never green either: it wears the neutral `ds-cash`.
- **Numbers are mono.** Every money figure, share count and percentage uses the `mono` family with tabular figures (the `.money` class). Labels and prose never do.
- **Whole rows are the target, and chevrons are honest.** Most rows carry no chevron: the whole row is tappable and its press state shows it. When a control does show one, a right chevron (`chevron-right`) means it pushes a new page and a down chevron (`chevron-down`) means it opens a sheet or picker. A value that leaves the app gets the external-link arrow, never a chevron.
- **One primary action per view.** A screen or sheet has at most one filled `ds-action` button; everything else is a tinted secondary, a text action or an icon button.
- **Type scales; geometry doesn't.** Type is specified at 100% and rendered at 120% (`--ds-font-scale: 1.2`). Gutters, radii, control heights and chart geometry stay at their specified px. The one exception is the holding weight ring, which grows with the type.

## Writing

- Sentence case everywhere: page titles, buttons, sheet titles, labels ("Filter by transaction type", "Save changes", "Total account value"). The only uppercase text is the tab labels and small eyebrow labels ("FILTER HISTORY").
- Name things the way the person thinks of them: "Cash deposit", "Buy NVDA", "Manually tracked", "Uninvested".
- Explain consequences in one plain sentence under the control, not in a tooltip: "This won’t change your holdings or cash balances." "Set the current balance, not the amount of a deposit." "Negative balances are supported. Saving records the difference as a deposit or withdrawal, dated today."
- Buttons say what happens: "Save balance", "Create account", "Add your first transaction", "Clear filters", "Buy again".
- Empty states are warm, short and point at the next step: "Your story starts here." then "Bought your first shares? Moved some cash? Add a transaction to start your record." When filters hide everything: "No matching transactions" and "Your other records are still here."
- Use typographic punctuation: curly apostrophes (won’t, today’s), a true minus sign (−$1,200.00, −3.4%), × for shares × price ("12 shares × $142.50"), and a middle dot to join facts ("Today · Oct 3", "All amounts in USD · Average-cost accounting").
- Signed figures always carry their sign: "+$3,402.10 · +12.2%". Percentages show one decimal.
- Money in more than one currency: a balance sits beside its currency code ("CAD", then "$8,300.00"), and a converted figure starts with "≈" and ends with the display currency's code ("≈ $5,818.03 USD"). "$" alone is US, Canadian or Australian dollars.
- Dates: "Today · Oct 3", then "Sep 30"; add the year only when it isn't this year.
- No emoji, no exclamation marks, no "Oops".

## Color

Use only `ds-*` tokens on new work. Each pair below has been checked for contrast in both themes; see Accessibility for the ones that fall short.

- **Ground and surfaces.** Pages, bars, sheets and footers sit on `ds-bg`. Anything recessed (a text field, a chip, an option tile, a pressed row, the close button) is `ds-subtle`. The html/body background is `ds-bg` too, because iOS paints the status bar from it.
- **Ink.** Titles, names and figures are `ds-text`. Labels and supporting copy are `ds-secondary`. Captions you can afford to miss (section meta, list footers, counts, placeholders, row chevrons) are `ds-muted`.
- **Lines.** Every divider and field border is `ds-line`, 1px.
- **Accent.** Back links, text actions, icon-button glyphs, the active state of a chip or option, and the price line use `ds-accent`. Its fill partner is `ds-accent-tint` (icon buttons, secondary buttons, active chips).
- **The filled button** is `ds-action` with `ds-action-ink`. Don't use `ds-accent` as a fill: it is lightened for text in dark mode.
- **Gain and loss.** `ds-positive`/`ds-negative` colour the figure; `ds-positive-bg`/`ds-negative-bg` sit under a return percentage only (the return pill). `ds-negative` is also the form error colour.
- **Transaction kinds.** Buy: `ds-accent` on `ds-accent-tint`. Sell: `ds-sell` on `ds-sell-bg`. Deposit: `ds-positive` on `ds-positive-bg`. Withdraw: `ds-withdraw` on `ds-withdraw-bg`. These appear only in the 32px kind icon, never as text colour.
- **Breakdown.** Holdings take `ds-hold-1` … `ds-hold-5` by rank of value (largest first), never by asset type. Past the fifth they all take `ds-hold-other`. Cash is `ds-cash`. These colour marks only (bar segments, rings, dots), always next to a text label. The [expense-tracking POC](patterns/expense-tracking.md) reuses this palette with stable category identities across months; spending changes stay neutral, not gain/loss coloured.
- **Chart indicators.** The 200-day average is `ds-indicator`; its ±5/10/15% bands are `ds-band-5`, `ds-band-10`, `ds-band-15`.
- **Dark mode** is the same token names with dark values. The app switches it with the `ion-palette-dark` class on the root element.

## Type

Three faces, each with one job. All three are self-hosted variable fonts so the app works offline on a cold launch.

- `display` (Inter): page titles, section titles, sheet titles, the sticky bar title, empty-state headlines, tab labels.
- `body` (Public Sans): everything else, including labels, buttons and the Back link.
- `mono` (JetBrains Mono): every figure, share count and percentage, with `font-variant-numeric: tabular-nums` and `-0.5px` tracking.

In code, write sizes as `var(--ds-fs-N)`, where N is the 100% size (8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 21, 22, 23, 27). The styles in Typography show the rendered size at 120%:

| Role | Style | Spec → rendered |
| --- | --- | --- |
| Page title | `page-title` | 23 → 27.6px, Inter 650 |
| Hero figure | `hero-figure` | 27 → 32.4px, mono 500 |
| Sheet title | `sheet-title` | 18 → 21.6px, Inter 600 |
| Empty-state headline | `empty-title` | 22 → 26.4px, Inter 550 |
| Section title, bar title | `section-title`, `bar-title` | 16 → 19.2px, Inter 600 |
| Back link | `back-link` | 15 → 18px, Public Sans 400 |
| Button | `button` | 13 → 15.6px, 600 |
| Row title, hero label, field text | `row-title`, `hero-label` | 12 → 14.4px |
| Labels, notices, help, errors | `body-help` | 11 → 13.2px |
| Section meta, date headings | `meta` | 10 → 12px |
| Row meta, footers, eyebrows | `row-meta`, `eyebrow` | 9 → 10.8px |
| The clipped account on a ledger row | `fine-print` | 8 → 9.6px |

Weights in use: 400, 500, 550, 600, 650, 700. Titles track tight (−0.4 to −0.8px), figures tighter (−0.5px; hero −1.2px).

## Layout and spacing

Design at 393pt wide (iPhone 15/16). Everything sits on one side inset, `ds-gutter` (23px), on every screen and sheet.

Rows are full-bleed for touch: they extend 10px into the gutter on both sides (`width: calc(100% + 20px); margin-inline: -10px; padding-inline: 10px`) so their press highlight is wider than their text, while the text stays on the gutter edge.

The source has only one spacing token. These are the recurring values, as written in the code:

| Value | Where |
| --- | --- |
| 6px band of `ds-subtle` | Between page sections (`border-top`) |
| 4px band of `ds-subtle` | Under the Transactions filter area, above the ledger |
| 50px | Sticky bar and Back bar height (plus the safe-area inset) |
| 52px | A full-screen task's top bar |
| 60px min | Ledger and account rows (10px padding, 10px gap) |
| 15px block padding | Holding rows (11px gap) |
| 44px min | Options in a sheet (8px × 11px padding, 3px apart) |
| 45px | Button height |
| 32px | Icon buttons and row glyphs |
| 16px + safe area | Tab-root heading top padding; 12px under a Back bar |
| 18px | Field label top margin; 8px label-to-field |
| 12px · 31px | Sheet top padding · bottom padding (or the home-indicator inset) |

Corner radii, also literal in the code:

| Radius | Where |
| --- | --- |
| 4px | Return pill, badge |
| 5px | Sheet grabber, chart expand button |
| 6px | Range buttons, indicator chips |
| 7px | Option tiles, currency chip |
| 8px | Text fields, search field, 32px row glyphs |
| 9px | Icon button |
| 10px | Buttons, filter chips, sheet options |
| 12px | 46px kind icon in a transaction sheet |
| 18px | 62px empty-state symbol |
| 22px | Bottom sheet top corners |
| 50% | Sheet close button |

## Screen anatomy

Every screen is one of four kinds; the next section, Screen anatomy, lists each one's parts in order. In short:

- **Tab root** (Portfolio, Transactions, Accounts, Settings): page heading at the top, the sticky bar appears once it scrolls away, tab bar at the bottom.
- **Pushed page** (a holding, an account, the cash): Back bar labelled with the tab's name, the page title below it as a large heading, no tab bar. A primary pair of actions (Buy / Sell) may take the tab bar's place.
- **Full-screen task** (new account, the add-transaction wizard): a top bar with Cancel, one question with a kicker, the fields, and a footer with the one action.
- **Bottom sheet**: grabber, title and round close button, then content that hugs its height up to 90% of the screen.

## Iconography

- Line icons on a 24×24 grid, `stroke-width` 1.6, round caps and joins, no fill, `currentColor`. Default size 20px; 14px for chevrons in rows and the sheet close; 12px for the chevron in a chip; 16px for search; 18px for kind glyphs.
- Exceptions copied as they are: the Back chevron has a 2px stroke at 22px; tab icons use 1.7 (the settings gear 1.5) at 20px.
- Icons inherit the ink of their control. Never colour an icon on its own except the kind icons and the cash glyph.
- In the app the icons are inline SVG in each page file. The Icons group here holds copies with the ink fixed to `ds-text` (light) so they show as images.
- No emoji, no illustrations. An empty state uses a line icon in a 62px `ds-subtle` square.
- The app icon is the green rising line on deep navy in Logos. `public/favicon.svg` is still Vite's default logo and is not part of the brand.

## Motion

- Fades only, 0.18s ease: the sticky bar and a Back bar title fade in when the heading scrolls under them.
- Content settles in on first paint with `ds-arrive` (from opacity 0 and 5px down): the Transactions and Accounts headings at 0.35s, Portfolio's hero, chart and breakdown at 0.4s.
- Sheets use the platform's slide-up; the backdrop is black at 40%.
- Respect `prefers-reduced-motion`: drop the transitions and the arrival animation.

## Accessibility

- Keyboard focus is a 3px `ds-focus` outline, offset 3px. Text fields instead turn their border `ds-accent` with a 1px inset ring of the same colour; underline fields thicken the underline instead.
- Every icon-only button has an `aria-label` ("Add transaction", "Rename account", "Close dialog"). The sticky bar repeats the heading, so it is `aria-hidden`.
- Interactive targets are at least 30px; buttons are 45px.
- Known contrast shortfalls, kept exactly as the app has them:
  - `ds-muted` text is 2.8:1 on `ds-bg` in light and 4.4:1 in dark. Use it only for captions a person can do without, or darken it.
  - `ds-focus` is 2.8:1 on `ds-bg` in light, under 3:1 for a focus ring.
  - `ds-action-ink` on `ds-action` is 4.47:1 in dark, just under 4.5:1.
  - `ds-hold-1` (2.95:1) and `ds-hold-4` (2.5:1) are under 3:1 on white. That's why breakdown colours always sit next to a label.

## What uses this system

On `ds-*` tokens: Portfolio, Holding detail, Cash (all the cash, by currency and by account), Transactions (list, filter and detail sheets), Accounts (list, account page, new account, rename, cash balance, display currency).

Still on the first system's tokens (`theme/variables.css`: `--surface`, `--fg-1…3`, `--signal`): the tab bar, Settings, Manage portfolio, Login, Onboarding, the add-transaction wizard, Transaction detail, a holding's transaction list, and the older pickers (PickerSheet, DateSheet, ActionSheetModal, including the portfolio switcher). Build new screens with `ds-*` only. When you move one of these over, rebuild it from the components here rather than re-tinting it.

## This folder

The design system lives here, in the repo, next to the code it describes. The order of authority: the app's code (`packages/portifo-web/src/theme/ds.css`, `src/index.css`) wins over this folder, and this folder wins over the published copy at https://claude.ai/artifact/CW3TpDYznXyazwXVv17BH2.

- Open `index.html` in a browser for the gallery: every component's preview, the icons, a light/dark switch. It works straight from disk.
- `README.md` (this file) and `screen-anatomy.md` are the rules; read both before designing a screen.
- `components/<Name>/README.md` is a component's rules; `preview.html` is its static rendition, styled by `components/bundle.css` (hand-copied from the app's `index.css`).
- `tokens.json` holds every colour, type style and the gutter. After editing it, or after adding a component or icon, run `node design-system/build.mjs` to regenerate `tokens.css` and `index.html`. Don't edit those two by hand.
- `assets/` holds the icons (ink fixed to light `ds-text`) and the app icon; `fonts/` the three self-hosted faces.
- When a change to the app alters a token or a component's rules, update the affected files here in the same commit, then re-publish the changed files to the artifact.
