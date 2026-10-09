# Sheet

A bottom sheet that slides up over the screen for a quick choice, a short form, or one record's details.

## When to use
- Choosing one option (filters, display currency): see `OptionList` and `OptionGrid`.
- A form of one to three fields that doesn't deserve its own screen (Rename account, Set cash balance).
- Reading one record without leaving the list (a transaction).
Use a full-screen task instead when the job needs several steps or more than a few fields (new account, adding a transaction).

## What you provide
- A title that names the choice or the job: "Filter by transaction type", "Display currency", "Rename account", "Set cash balance". For a record, its own title ("Buy NVDA").
- The content, and the one action if there is one.
- Optionally notices above or below the content explaining what the change does.

## Rules
- Ground `ds-bg`, top corners 22px, no shadow; the screen behind dims with 40% black.
- Hugs its content up to 90% of the screen, then scrolls. Padding 12px top, `ds-gutter` sides, 31px bottom (or the home-indicator inset, whichever is larger).
- Grabber: 34×4px `ds-line`, radius 5px, centred, 19px above the header.
- Header: title in `sheet-title` (Inter 600, `--ds-fs-18`, −0.5px) on the left; a 30px round close button on the right (`ds-secondary` × at 14px on `ds-subtle`, labelled "Close dialog"). 18px below the header.
- Notices (`ds-sheet-notice`): `--ds-fs-11`, line-height 1.8, `ds-secondary`, 16px above and below. One or two sentences about consequences: "This won’t change your holdings or cash balances."
- At most one filled `Button`, full width, last. Swiping down, the close button and tapping the backdrop all dismiss it.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.ds-sheet*`) and `src/components/DsSheet.tsx`.
