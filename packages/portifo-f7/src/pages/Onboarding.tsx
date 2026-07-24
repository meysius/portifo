import { useState } from "react";
import { useStore } from "framework7-react";
import { store } from "../store.ts";
import type { AccountDto } from "../api/accounts";
import { CashGlyph, InvestmentGlyph } from "../components/Glyphs.tsx";

const STEPS = {
  investment: {
    icon: <InvestmentGlyph />,
    title: "Set up your Investment Account",
    body: "This is where you'll buy and sell investments. Its balance and holdings stay in sync automatically from the transactions you record — so it always shows exactly how much you've deposited, which matters for accounts like a TFSA.",
    placeholder: "e.g. Wealthsimple TFSA",
  },
  cash: {
    icon: <CashGlyph />,
    title: "Set up your Cash Account",
    body: "Portifo also tracks cash you're holding outside your investments. To keep you from logging every small transfer, a cash account's balances are set directly rather than built from transactions — and it can hold a separate balance for each currency.",
    placeholder: "e.g. Household Checking",
  },
} as const;

// Rendered as plain content inside RootPage's single, permanently-mounted
// <Page> whenever the active portfolio doesn't yet have both an Investment
// and a Cash account (see Root.tsx) — walks the user through creating both.
// docs/system-design-2.html Screens: Onboarding.
export default function OnboardingContent() {
  const accounts = useStore(store, "accounts") as AccountDto[];
  // Resumes at step 2 on reload if the Investment account already exists.
  const [step, setStep] = useState<"investment" | "cash">(
    accounts.some((a) => a.type === "investment") ? "cash" : "investment",
  );
  const [investmentName, setInvestmentName] = useState("");
  const [cashName, setCashName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = step === "investment" ? investmentName : cashName;
  const setName = step === "investment" ? setInvestmentName : setCashName;
  const isValid = name.trim().length > 0;
  const copy = STEPS[step];

  const handleContinue = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await store.dispatch("createAccount", { name: name.trim(), type: step });
      if (step === "investment") setStep("cash");
      // Finishing the cash step takes the portfolio from zero accounts to
      // two — the App gate's own accounts check is what swaps this screen
      // for the tab bar once that refetch lands.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="onboard-screen">
      <div className="onboard-steps">
        <span className="onboard-step on" />
        <span className={step === "cash" ? "onboard-step on" : "onboard-step"} />
      </div>

      <div className="empty" style={{ paddingTop: 4 }}>
        <div className="empty-badge">{copy.icon}</div>
        <div className="empty-title">{copy.title}</div>
        <div className="empty-body" style={{ maxWidth: "34ch" }}>
          {copy.body}
        </div>
      </div>

      <div className="field-card">
        <div className="field">
          <span className="field-label">Account Name</span>
          <input
            className="field-input"
            value={name}
            placeholder={copy.placeholder}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <div className="btn-stack">
        {error && <span className="field-error">{error}</span>}
        <button type="button" className="btn btn-primary" disabled={!isValid || saving} onClick={handleContinue}>
          {saving ? <span className="inline-spinner" /> : "Continue"}
        </button>
      </div>
    </div>
  );
}
