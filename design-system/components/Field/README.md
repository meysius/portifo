# Field

A labelled text, number or select field on a recessed fill, with its error line.

## When to use
Every typed or selected value in a sheet or a task: an account name, a cash balance, a currency. A search box over a list uses the search variant.

## What you provide
- A label above the field, in sentence case, saying what to enter: "Account name", "Current cash balance", "Currency".
- The value, a placeholder only where it shows the format ("0.00"), and an `id` the label points at.
- The error message, written as what to do ("Enter an account name, up to 60 characters.", "Enter a valid cash balance below one trillion."): shown under the field with `role="alert"`, cleared as soon as the person edits.

## Rules
- Label: `--ds-fs-11`, `ds-secondary`, 18px above and 8px below.
- Field: full width, 12px padding, a 1px `ds-line` border, radius 8px, `--ds-fs-12` `ds-text` on `ds-subtle`. Number fields are mono.
- Focus: the border turns `ds-accent` with a 1px inset ring of the same colour, inside the field (no outer outline that could clip in a scrolling sheet).
- Disabled (a currency that can't change): text turns `ds-secondary`, nothing else changes.
- Error: `--ds-fs-11`, line-height 1.6, `ds-negative`, 12px under the field.
- Search: the icon and input sit inside one bordered box (padding 0 11px, input 38px tall, 8px gap); the whole box takes the focus ring, never the input alone.
- A single prominent name in a full-screen task is an underline field instead: no box, a `ds-line` bottom border, `--ds-fs-18` 550; focus thickens the underline in `ds-accent`.
- Spinner arrows on number fields are hidden; keep native validation and arrow keys.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.ds-field*`, `.ds-form-error`, `.tl-search-field`) and `src/theme/focus.css`.
