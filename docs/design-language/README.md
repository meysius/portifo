# Design Language

Portifo's design language, split into small standalone pieces instead of one
monolithic HTML file. This is the source of truth for design and screen work
— superseding `docs/design-system.html`. Read only the piece you need; each
file is a self-contained HTML page you can open directly in a browser (theme
toggle included) and is small enough to read in full without burning context.

Workflow: when a user wants to change the design or a screen, edit the
relevant file(s) here first, get it approved, then implement it in
`packages/portifo-web`.

## Structure

```
design-language/
  foundations/        shared CSS/JS every other page links to
    fonts.css          @font-face — Public Sans, Space Grotesk, JetBrains Mono
    tokens.css          color variables (:root + light/dark overrides)
    base.css             reset + every component class (cards, rows, tabbar, fields, buttons, device frame, navbars, etc.)
    theme-toggle.js       the System/Light/Dark toggle used on every page
  colors.html          color palette & swatches
  typography.html      the three type roles (JetBrains Mono / Space Grotesk / Public Sans)
  signature.html       the calibration-line signature device
  components.html      live component specimens (cards, rows, tabbar, gauge, stat grid, etc.)
  fields.html           form fields, segmented controls, account picker rows
  screens/              one file per current screen
    login.html                 device-framed
    onboarding.html            device-framed
    portfolio.html             device-framed, at rest
    portfolio-scrolled.html    device-framed, collapsed navbar
    cash-detail.html           device-framed
    stock-detail.html          device-framed
    add-transaction.html       loose-card (no device-frame pass yet)
    account-detail.html        loose-card (no device-frame pass yet)
    settings.html               loose-card (no device-frame pass yet)
    empty-state.html            loose-card (no device-frame pass yet) — shared across Holdings/Transactions/Accounts
```

The old `legacy.html` mockups now live at `docs/new-design-system/screens.html`,
rebuilt at true iPhone 16 scale (393 × 852pt) with per-screen build notes —
Onboarding, Portfolio and Holding Detail. That file, not these, is what the
frontend should be implemented against for those three screens.

## Notes

- Screens without a `-scrolled`/device-frame note are still in their original
  loose-card form because they haven't had a device-frame pass yet — that's
  expected, not a gap in the split.
- The device frame here is 402 × 874pt (iPhone 16 Pro).
  `docs/new-design-system/` uses a true iPhone 16 frame at 393 × 852pt — when
  porting a screen between the two, re-check anything that was tuned to fit the
  fold, since the viewport is 9pt narrower and 22pt shorter.
- Split from `docs/system-design-2.html` on 2026-07-24 (every section verified
  byte-identical against the original before it was removed).
