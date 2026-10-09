# Button

The full-width action at the end of a form, sheet or empty state, plus the smaller text and icon actions.

## When to use
- **Primary** (`ds-action`): the one thing the view is for: "Save changes", "Save balance", "Create account", "Add your first transaction". One per view. A pick-one sheet (`OptionList`, `OptionGrid`) has none: tapping an option applies it.
- **Secondary** (`.secondary`): a second, safer path next to a primary, or the single action of an empty state that only undoes something ("Clear filters").
- **Text action**: small in-place actions that don't leave the view: "Clear all", "Add currency", "Show all".
- **Icon button**: a page heading's add action (accent on tint) or a Back bar's quiet edit (secondary ink, no fill). Always with an `aria-label`.

## What you provide
A label that says what happens, in sentence case, starting with a verb. Disable the primary until the form can be submitted, and say why next to it when it isn't obvious.

## Rules
- Primary: full width, at least 45px, padding 12px × 14px, radius 10px, `button` (`--ds-fs-13` 600) in `ds-action-ink` on `ds-action`. 18px above it.
- Secondary: the same shape in `ds-accent` on `ds-accent-tint`, 8px under a primary.
- Disabled: `ds-muted` on `ds-subtle`, `cursor: not-allowed`. No opacity fade.
- Text action: `ds-accent`, no fill, `--ds-fs-11` (or `--ds-fs-10` for "Clear all"), with generous padding for touch.
- Icon button: 32px, radius 9px, 20px glyph. Default `ds-accent` on `ds-accent-tint`; quiet is `ds-secondary` with no fill.
- No destructive red buttons for ordinary actions: selling and withdrawing aren't destructive.
- Focus: 3px `ds-focus` outline, offset 3px.

Static rendition, hand-written from `packages/portifo-web/src/index.css` (`.ds-action`, `.tl-action`, `.ds-icon-button`, `.tl-clear-filters`, `.ac-add-currency`).
