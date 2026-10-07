# BottomActions

A pushed page's main pair of actions, pinned where the tab bar was.

## When to use
Only on a pushed page whose purpose is to act on the thing shown: Buy and Sell on holding detail. Pages that are mostly read (an account) don't get one.

## What you provide
One or two labels. The first is the primary. Labels are single verbs: "Buy", "Sell"; a closed holding shows only "Buy again".

## Rules
- Pinned at the bottom: `ds-bg`, a `ds-line` hairline above, padding 12px `ds-gutter` and the home-indicator inset (at least 25px) below.
- Buttons share the row equally, 10px apart, 45px tall, radius 10px, `--ds-fs-14` 600.
- The first is filled (`ds-action-ink` on `ds-action`); the second is tinted (`ds-accent` on `ds-accent-tint`). Sell is tinted, never red: selling is not destructive.
- Pressed: 85% opacity.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.hd-actions`, `.hd-action`) and `src/pages/AssetDetailPage.tsx`.
