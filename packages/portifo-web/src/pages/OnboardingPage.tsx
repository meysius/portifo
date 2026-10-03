import { IonContent, IonInput, IonItem, IonLabel, IonList, IonPage, IonSpinner } from "@ionic/react";
import { useState } from "react";
import { FolderGlyphIcon } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useToast } from "../context/ToastContext";

// Runs instead of the tab bar whenever the active portfolio has zero
// accounts (see AuthGate) — one step: name the first account. Creating it
// takes the portfolio to one account, and AuthGate's own accounts check is
// what swaps this screen for the tab bar once that refetch lands.
function OnboardingPage() {
  const { createAccount } = usePortfolioData();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0;

  const handleContinue = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await createAccount({ name: name.trim() });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create account", { color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="onboard-content">
        <div className="onboard-screen">
          <div className="empty-state" style={{ paddingTop: 4 }}>
            <div className="empty-badge">
              <FolderGlyphIcon />
            </div>
            <div className="empty-title">Name your first account</div>
            <div className="empty-body" style={{ maxWidth: "34ch" }}>
              An account is wherever your money sits — a brokerage, a TFSA, a chequing account. Each one can hold
              shares and cash in any currency, and you can add more later.
            </div>
          </div>

          <IonList inset className="fieldcard-list form-list">
            <IonItem>
              <IonLabel>Account Name</IonLabel>
              <IonInput
                slot="end"
                className="ion-text-end"
                value={name}
                placeholder="e.g. Wealthsimple TFSA"
                onIonInput={(e) => setName(e.detail.value ?? "")}
              />
            </IonItem>
          </IonList>

          <div className="btn-stack">
            <button type="button" className="btn btn-primary" disabled={!isValid || saving} onClick={handleContinue}>
              {saving ? <IonSpinner name="crescent" className="inline-spinner" /> : "Continue"}
            </button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default OnboardingPage;
