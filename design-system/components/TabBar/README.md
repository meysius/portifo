# TabBar

The bottom menu: four fixed tabs that switch between the tab roots.

## When to use
On tab roots only (Portfolio, Transactions, Accounts, Settings). It disappears while any pushed page is on screen, and full-screen tasks and sheets cover it.

## Rules
- Always these four, always in this order: Portfolio, Transactions, Accounts, Settings. Don't add a fifth or reorder them per screen.
- Idle and selected differ by ink, not weight: `ion-tab-bar-color` to `ion-tab-bar-color-selected`, icon and label together.
- The accent lives only in the selected tab's marker: a 20×2px bar of `signal`, centred on the bar's top edge. Never colour the selected label or icon with the accent, and never add a pill or highlight behind the icon.
- Labels are uppercase `tab-label` (Inter 9.5px/600, +0.03em), fixed size, not scaled with the type.
- Icons are 20px line icons (1.7 stroke; the gear 1.5) in `currentColor`.
- The bar is 54px plus a 1px `ion-border-color` hairline plus the home-indicator inset (34pt on device) = 89pt. No shadow.

## Not yet on ds-* tokens
The tab bar still reads the first system's tokens (`theme/variables.css`). The design studies drew it differently (sentence-case 9px labels, the selected tab in `ds-accent`, no marker). Decide which one is right before moving it to `ds-*`; until then the app's version shown here is the rule.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`ion-tab-bar` rules) and `src/Tabs.tsx`.
