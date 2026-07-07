import { IonModal } from "@ionic/react";
import type { ReactNode } from "react";

export type SheetAction = {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onClick: () => void;
};

// DS contextual action sheet (.sheet-panel + .action-list + .action-cancel).
// The native IonActionSheet can't take this shape — no handle, centered
// borderless buttons, detached groups — so it's a sheet modal instead.
function ActionSheetModal({
  isOpen,
  onClose,
  title,
  subtitle,
  actions,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
}) {
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      className="auto-sheet"
    >
      <div className="sheet-panel-head">
        <span className="sheet-panel-title">{title}</span>
        {subtitle && <span className="sheet-panel-sub">{subtitle}</span>}
      </div>
      <div className="sheet-panel-body">
        <div className="action-list">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.destructive ? "action-row destructive" : "action-row"}
              onClick={() => {
                onClose();
                a.onClick();
              }}
            >
              {a.icon && <span className="a-icon">{a.icon}</span>}
              <span className="a-label">{a.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="action-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </IonModal>
  );
}

export default ActionSheetModal;
