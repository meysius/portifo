import { IonContent, IonInput, IonItem, IonLabel, IonList, IonPage, IonSpinner } from "@ionic/react";
import { useState } from "react";
import { CashGlyphIcon, FolderGlyphIcon } from "../components/ds";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useToast } from "../context/ToastContext";

const STEPS = {
  investment: {
    icon: <FolderGlyphIcon />,
    title: "Set up your investment account",
    body: "This is where you'll buy and sell investments. Its balance and holdings stay in sync automatically from the transactions you record — so it always shows exactly how much you've deposited, which matters for accounts like a TFSA.",
    placeholder: "e.g. Wealthsimple TFSA",
  },
  cash: {
    icon: <CashGlyphIcon />,
    title: "Set up your cash account",
    body: "Portifo also tracks cash you're holding outside your investments. To keep you from logging every small transfer, a cash account's balances are set directly rather than built from transactions — and it can hold a separate balance for each currency.",
    placeholder: "e.g. Household Checking",
  },
} as const;

// Runs instead of the tab bar whenever the active portfolio has zero
// accounts (see AuthGate) — walks the user through creating their first
// Investment and Cash account before the usual navigation appears.
// docs/design-system.html Screens: Onboarding Step 1/2.
function OnboardingPage() {
  const { accounts, createAccount } = usePortfolioData();
  const { showToast } = useToast();
  // Resumes at step 2 on reload if the Investment account already exists
  // (e.g. the request landed but a refresh interrupted the step 1→2
  // transition) instead of prompting to create a second one.
  const [step, setStep] = useState<"investment" | "cash">(
    accounts.some((a) => a.type === "investment") ? "cash" : "investment",
  );
  const [investmentName, setInvestmentName] = useState("");
  const [cashName, setCashName] = useState("");
  const [saving, setSaving] = useState(false);

  const name = step === "investment" ? investmentName : cashName;
  const setName = step === "investment" ? setInvestmentName : setCashName;
  const isValid = name.trim().length > 0;
  const copy = STEPS[step];

  const handleContinue = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await createAccount({ name: name.trim(), type: step });
      if (step === "investment") setStep("cash");
      // Finishing the cash step takes the portfolio from zero accounts to
      // two — AuthGate's own accounts.length check is what actually swaps
      // this screen for the tab bar once that refetch lands.
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
          <div className="onboard-steps">
            <span className="onboard-step on" />
            <span className={step === "cash" ? "onboard-step on" : "onboard-step"} />
          </div>

          <div className="empty-state" style={{ paddingTop: 4 }}>
            <div className="empty-badge">{copy.icon}</div>
            <div className="empty-title">{copy.title}</div>
            <div className="empty-body" style={{ maxWidth: "34ch" }}>
              {copy.body}
            </div>
          </div>

          <IonList inset className="fieldcard-list form-list">
            <IonItem>
              <IonLabel>Account Name</IonLabel>
              <IonInput
                slot="end"
                className="ion-text-end"
                value={name}
                placeholder={copy.placeholder}
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
