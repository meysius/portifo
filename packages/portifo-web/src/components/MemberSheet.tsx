import { IonItem, IonLabel, IonList, IonModal } from "@ionic/react";
import { RadioDot, TrashIcon, roleLabel } from "./ds";
import type { MemberDto, MemberRole } from "../api/portfolio";

const ROLE_OPTIONS: { value: MemberRole; description: string }[] = [
  { value: "owner", description: "Full access, can delete the portfolio" },
  { value: "editor", description: "Can add and edit transactions" },
  { value: "viewer", description: "Can view only" },
];

// DS "Member sheet" — opened by tapping a member's row in Manage Portfolio.
// Combines two Components patterns in one sheet: role is a radio-row
// single-select exactly like the currency/account pickers (tapping a row
// changes it immediately), and Remove sits below as its own single-row
// action-list, borrowing the destructive action-row styling. Works the same
// for a Pending row — the title falls back to the bare email, and Remove
// just deletes the row outright, since no invite was ever sent to cancel.
function MemberSheet({
  member,
  busy,
  onClose,
  onChangeRole,
  onRemove,
}: {
  member: MemberDto | null;
  busy: boolean;
  onClose: () => void;
  onChangeRole: (role: MemberRole) => void;
  onRemove: () => void;
}) {
  return (
    <IonModal isOpen={member !== null} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]} className="auto-sheet">
      <div className="sheet-panel-head" style={{ flexDirection: "column", gap: 1, paddingBottom: 8 }}>
        <span className="sheet-panel-title">{member?.name ?? member?.email}</span>
        <span className="sheet-panel-sub">
          {member?.pending ? "Pending · " : `${member?.email} · `}
          {member ? roleLabel(member.role) : ""}
        </span>
      </div>
      <div className="sheet-panel-body">
        <IonList lines="full">
          {ROLE_OPTIONS.map((option) => (
            <IonItem
              key={option.value}
              button
              detail={false}
              disabled={busy}
              onClick={() => onChangeRole(option.value)}
            >
              <IonLabel>
                <h2>{roleLabel(option.value)}</h2>
                <p>{option.description}</p>
              </IonLabel>
              <RadioDot checked={member?.role === option.value} />
            </IonItem>
          ))}
        </IonList>

        <div className="action-list" style={{ marginTop: 14 }}>
          <button type="button" className="action-row destructive" disabled={busy} onClick={onRemove}>
            <span className="a-icon">
              <TrashIcon />
            </span>
            <span className="a-label">Remove from Portfolio</span>
          </button>
        </div>
        <button type="button" className="action-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </IonModal>
  );
}

export default MemberSheet;
