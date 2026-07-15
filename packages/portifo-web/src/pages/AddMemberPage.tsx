import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonToolbar,
} from "@ionic/react";
import { useState } from "react";
import { useHistory } from "react-router-dom";
import PickerSheet from "../components/PickerSheet";
import { roleLabel } from "../components/ds";
import type { MemberRole } from "../api/portfolio";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useToast } from "../context/ToastContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_OPTIONS: MemberRole[] = ["owner", "editor", "viewer"];

// Add Member (design-system Screens section): Email + Role, closed by one
// .btn-primary. No invite is ever sent — the address itself is the access
// grant, matched against Google Sign-In the next time it logs in (see the
// .field-note below the fields, and Manage Portfolio's Pending row for what
// that looks like before it does).
function AddMemberPage() {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const { addMember, portfolioDetail } = usePortfolioData();
  const { showToast } = useToast();
  const portfolioName = portfolioDetail?.name ?? "this portfolio";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("editor");
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const trimmedEmail = email.trim().toLowerCase();
  const isValid = EMAIL_RE.test(trimmedEmail);

  const handleAdd = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await addMember(trimmedEmail, role);
      showToast("Member added");
      history.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add member", { color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={tabBase} text={tabLabel} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div className="detail-hero">
          <div className="detail-symrow">
            <span className="detail-sym">Add Member</span>
          </div>
          <div className="detail-name">{portfolioName}</div>
        </div>

        <IonList inset className="fieldcard-list form-list">
          <IonItem>
            <IonLabel>Email</IonLabel>
            <IonInput
              slot="end"
              className="ion-text-end"
              type="email"
              inputmode="email"
              placeholder="name@example.com"
              value={email}
              onIonInput={(e) => setEmail(e.detail.value ?? "")}
            />
          </IonItem>
          <IonItem button detail onClick={() => setRoleSheetOpen(true)}>
            <IonLabel>Role</IonLabel>
            <IonLabel slot="end" key={role}>
              {roleLabel(role)}
            </IonLabel>
          </IonItem>
        </IonList>

        <p className="field-note">
          No invite is sent. Ask them to sign in to Portifo with this Gmail address — they'll get access to{" "}
          {portfolioName} the moment they do.
        </p>

        <div className="btn-stack">
          <button type="button" className="btn btn-primary" disabled={!isValid || saving} onClick={handleAdd}>
            Add Member
          </button>
        </div>

        <PickerSheet
          mode="static"
          isOpen={roleSheetOpen}
          title="Role"
          selected={role}
          options={ROLE_OPTIONS.map((r) => ({ value: r, label: roleLabel(r) }))}
          onClose={() => setRoleSheetOpen(false)}
          onSelect={(value) => setRole(value as MemberRole)}
        />
      </IonContent>
    </IonPage>
  );
}

export default AddMemberPage;
