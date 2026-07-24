import { Navbar, Page, useStore } from "framework7-react";
import { store } from "../store.ts";
import type { AccountDto } from "../api/accounts";
import LoginContent from "./Login.tsx";
import OnboardingContent from "./Onboarding.tsx";

// The single component behind the "/" route — always mounted, never torn
// down. Framework7 mounts routed pages through its own imperative page
// loader, outside normal React reconciliation, so swapping between
// separate top-level <View>s for logged-out / onboarding / main states
// left orphaned DOM behind (Login and Holdings content both rendering at
// once). Gating instead happens as a plain conditional on what this one
// permanently-mounted <Page> renders, driven by the Framework7 Store (see
// store.ts) rather than React Context, since Context set up by a JSX
// ancestor doesn't reach components Framework7 mounts this way either.
export default function RootPage() {
  const authStatus = useStore(store, "authStatus") as "loading" | "unauthenticated" | "authenticated";
  const loadingAccounts = useStore(store, "loadingAccounts") as boolean;
  const hasBothAccountTypes = useStore(store, "hasBothAccountTypes") as boolean;
  const accounts = useStore(store, "accounts") as AccountDto[];

  if (authStatus === "loading" || (authStatus === "authenticated" && loadingAccounts)) {
    return (
      <Page name="root">
        <div className="auth-loading">
          <span className="inline-spinner" />
        </div>
      </Page>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <Page name="root">
        <LoginContent />
      </Page>
    );
  }

  if (!hasBothAccountTypes) {
    return (
      <Page name="root">
        <OnboardingContent />
      </Page>
    );
  }

  // Placeholder landing page — the real Holdings screen (hero value,
  // allocation gauge, holdings list) is a separate follow-up; this just
  // confirms onboarding landed the user on the portfolio with its accounts.
  return (
    <Page name="root">
      <Navbar large title="Portifo" />
      <div style={{ padding: "20px 16px" }}>
        <span className="eyebrow">Total Portfolio Value</span>
        <div className="figure figure-hero" style={{ marginTop: 4 }}>
          <span className="cur">$</span>0<span className="cents">.00</span>
        </div>

        <div className="empty" style={{ marginTop: 40 }}>
          <div className="empty-title">Nothing tracked yet</div>
          <div className="empty-body">
            This is a placeholder — the real Holdings screen (allocation, holdings list) comes next. Onboarding did
            create these accounts for you:
          </div>
        </div>

        <div className="field-card" style={{ marginTop: 20 }}>
          {accounts.map((a, i) => (
            <div className="field" key={a.id} style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}>
              <span className="field-label">{a.name}</span>
              <span className="field-input" style={{ textTransform: "capitalize" }}>
                {a.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
