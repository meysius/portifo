import { IonContent, IonInput, IonItem, IonLabel, IonList, IonPage, IonSpinner } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import ActionSheetModal from "../components/ActionSheetModal";
import { FolderGlyphIcon } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useToast } from "../context/ToastContext";

// Runs instead of the tab bar whenever the active portfolio has zero
// accounts (see AuthGate) — one step: name the first account. Creating it
// takes the portfolio to one account, and AuthGate's own accounts check is
// what swaps this screen for the tab bar once that refetch lands.
function OnboardingPage() {
  const { createAccount, portfolios, activePortfolio, switchPortfolio } = usePortfolioData();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const inputRef = useRef<HTMLIonInputElement>(null);

  // A portfolio made by mistake (or one you just want to leave for later)
  // must not trap you here: with no tab bar, this is the only way back.
  const otherPortfolios = portfolios.filter((p) => p.id !== activePortfolio?.id);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.setFocus(), 350);
    return () => clearTimeout(t);
  }, []);

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
              <IonLabel>Name</IonLabel>
              <IonInput
                ref={inputRef}
                slot="end"
                className="ion-text-end"
                value={name}
                placeholder="e.g. My TFSA"
                enterkeyhint="go"
                onIonInput={(e) => setName(e.detail.value ?? "")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleContinue();
                }}
              />
            </IonItem>
          </IonList>

          <div className="btn-stack">
            <button type="button" className="btn btn-primary" disabled={!isValid || saving} onClick={handleContinue}>
              {saving ? <IonSpinner name="crescent" className="inline-spinner" /> : "Continue"}
            </button>
            {otherPortfolios.length > 0 && (
              <button type="button" className="onboard-switch" onClick={() => setSwitchOpen(true)}>
                Switch to another portfolio
              </button>
            )}
          </div>
        </div>

        <ActionSheetModal
          isOpen={switchOpen}
          onClose={() => setSwitchOpen(false)}
          title="Switch Portfolio"
          subtitle={`${activePortfolio?.name ?? "This portfolio"} stays here for later`}
          actions={otherPortfolios.map((p) => ({ label: p.name, onClick: () => switchPortfolio(p.id) }))}
        />
      </IonContent>
    </IonPage>
  );
}

export default OnboardingPage;
