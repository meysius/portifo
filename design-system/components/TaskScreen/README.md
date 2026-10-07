# TaskScreen

A full-screen form for creating something: one question, its fields, and one action pinned at the bottom.

## When to use
When creating needs more than a sheet can hold or takes several steps: a new account (name plus starting cash balances), adding a transaction. It covers the tab bar and the page beneath.

## What you provide
- The task's name for the top bar ("New account").
- A kicker, a short headline and an intro of one or two plain sentences: "A new place for your money", "Make it your own.", "Add the broker, bank or wallet you already use. No connection or login needed."
- The fields, grouped with small headings ("Opening cash" with "Optional").
- The action ("Create account"), disabled until the form can be submitted, and optionally one line of fine print under it ("Opening cash is recorded as a deposit, dated today.").

## Rules
- Top bar: 52px with a `ds-line` hairline below. Cancel on the left (`--ds-fs-11`, `ds-secondary`), title centred in `task-bar-title` (Inter 600, `--ds-fs-13`), a 40px spacer on the right. No Back chevron.
- Body scrolls: 24px top padding. Kicker in `eyebrow` style, `ds-accent`, 9px above the headline. Headline in `form-title` (Inter 600, `--ds-fs-23`, −0.7px). Intro `--ds-fs-11`, line-height 1.7, `ds-secondary`, 24px above the first field.
- The main name is an underline field (see `Field`). Repeating rows (a balance per currency) are a grid of amount, a 78px currency select and a 26px remove button, 9px apart, with "Add currency" as a text action under them.
- Group headings: `--ds-fs-12` 600 with "Optional" in `--ds-fs-9` `ds-muted` on the right, 28px above the group.
- Footer pinned to the bottom: a `ds-line` hairline above, 12px top padding, the `Button` with no top margin, and the home-indicator inset (at least 24px) below. Fine print `--ds-fs-9` `ds-muted`, centred, 10px under the button.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.ac-create`, `.ac-form-*`, `.ac-balance-entry`) and `src/components/AddAccountModal.tsx`.
