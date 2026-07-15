import type { ReactNode } from "react";
import { fmtCcy } from "../lib/fx";

// Shared design-system primitives — the exact SVG line icons and idioms from
// docs/design-system.html, so every screen draws from one vocabulary.

/* Splits a currency-formatted money string for the Fraunces hero: whole part
   (with its currency symbol) at full size, cents smaller and secondary
   (DS .hero-value / .cents). Zero-decimal currencies (JPY) return "" cents. */
export function splitMoneyCcy(n: number, currency: string): [string, string] {
  const s = fmtCcy(n, currency);
  const i = s.lastIndexOf(".");
  if (i === -1) return [s, ""];
  return [s.slice(0, i), s.slice(i + 1)];
}

/* DS .hero-value (+ ledger-grid backdrop via .hero-value-row) — the one
   Fraunces figure a screen is most proud of. `small` is the 36px detail-screen
   variant. */
export function MoneyHero({ value, currency, small }: { value: number; currency: string; small?: boolean }) {
  const [whole, cents] = splitMoneyCcy(value, currency);
  return (
    <div className="hero-value-row">
      <h1 className={small ? "hero-value hero-value--sm" : "hero-value"}>
        {whole}
        {cents && <span className="hero-cents">.{cents}</span>}
      </h1>
    </div>
  );
}

/* DS .add-btn plus. */
export function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5V14.5M1.5 8H14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* DS .ccy-pill / .portfolio-switch chevron. */
export function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 12 8" fill="none" aria-hidden="true">
      <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* DS .field-chevron — marks a row that opens a picker or settings page. */
export function ChevronRightIcon() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden="true">
      <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* DS .pnl / .hero-change arrows. */
export function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 9V1M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 1V9M1 5L5 9L9 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* DS .glyph.cash — banknote. */
export function CashGlyphIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/* DS .glyph.closed-g — squared-off ledger mark for a closed position. */
export function ClosedGlyphIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* DS Accounts-tab glyph — folder. */
export function FolderGlyphIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7.5a2 2 0 0 1 2-2h11l4 4v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M15 12.2h3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/* DS .action-row plus (20px grid, lighter stroke than the fab's). */
export function ActionPlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* DS .action-row.destructive trash. */
export function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 6h12M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6M6 6l.6 10a1.4 1.4 0 0 0 1.4 1.3h4a1.4 1.4 0 0 0 1.4-1.3L14 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* DS .radio-dot check. */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 11 9" fill="none" aria-hidden="true">
      <path d="M1 4.5L4 7.5L10 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* DS .radio-dot — trailing single-select indicator for picker rows. */
export function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span slot="end" className={checked ? "radio-dot checked" : "radio-dot"} aria-hidden="true">
      {checked && <CheckIcon />}
    </span>
  );
}

/* DS .glyph.member — initials avatar for a person row (Manage Portfolio's
   member list, Settings' own profile row via the `lg` size). Falls back to
   "?" for a Pending row's bare email if it somehow starts with a non-letter. */
export function MemberInitial({ label }: { label: string }) {
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  return <span className="member-initial">{initial}</span>;
}

export function roleLabel(role: "viewer" | "editor" | "owner"): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/* DS group divider — mono uppercase label with trailing hairline; optionally
   ends in the screen's one brass .add-btn (Account Detail's Cash divider). */
export function ListDivider({ label, onAdd, addLabel }: { label: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="list-divider">
      <span className="dl">{label}</span>
      <span className="dh" />
      {onAdd && (
        <button type="button" className="add-fab" aria-label={addLabel ?? "Add"} onClick={onAdd}>
          <PlusIcon />
        </button>
      )}
    </div>
  );
}

/* DS .empty-state — line icon in a brass-tint circle, never an emoji or
   stock illustration; optionally ends in the screen's primary action. */
export function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  onCta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-badge">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-body">{body}</div>
      {ctaLabel && onCta && (
        <button type="button" className="btn btn-primary empty-cta" onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

/* DS empty-state badge icons (34px line icons). */
export function LedgerIcon() {
  return (
    <svg viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="24" height="30" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 12h12M11 17h12M11 22h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="12" width="18" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="5" y="7" width="14" height="5" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="7" y="3" width="10" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function FolderIcon() {
  return <FolderGlyphIcon />;
}

/* Install-guide inline glyphs — iOS Safari's share-square, Android Chrome's
   kebab menu, and a generic "add to home screen" tile-plus. */
export function ShareGlyphIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5v10M6.5 6 10 2.5 13.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 9.5v6a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuKebabGlyphIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="4.5" r="1.3" fill="currentColor" />
      <circle cx="10" cy="10" r="1.3" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function AddHomeGlyphIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.8v6.4M6.8 10h6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* Login screen's "Install App" CTA — a phone outline with a download arrow
   landing on the home-indicator, reading as "put this on your phone" rather
   than a generic add-square. */
export function InstallGlyphIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="5" y="1.5" width="10" height="17" rx="2.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 5.5v6.2M7.3 9.3 10 12l2.7-2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 15.7h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
