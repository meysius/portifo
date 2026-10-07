import { IonModal } from "@ionic/react";
import type { ReactNode } from "react";

// A bottom sheet in the second design system: grabber, title, round close,
// and a body that hugs its content (up to 90% of the screen, then scrolls).
// It renders whatever it is given while it slides away, so callers keep the
// sheet's content after closing it.
export default function DsSheet({
  isOpen,
  onClose,
  title,
  titleId,
  className = "",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      handle={false}
      className={`auto-sheet ds-sheet ds-screen ${className}`}
      aria-labelledby={titleId}
    >
      <div className="ds-sheet-body">
        <div className="ds-sheet-grabber" aria-hidden="true" />
        <div className="ds-sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ds-close-sheet" aria-label="Close dialog" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </IonModal>
  );
}
