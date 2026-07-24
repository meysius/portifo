import { useState } from "react";
import { store } from "../store.ts";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.6 9.2c0-.6-.05-1.2-.15-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.4 0 4.5-.8 6-2.1l-2.9-2.2c-.8.5-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.7H.9v2.3A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.9 10.9a5.4 5.4 0 0 1 0-3.4V5.2H.9a9 9 0 0 0 0 7.6l3-2Z" />
      <path
        fill="#EA4335"
        d="M9 3.6c1.3 0 2.5.45 3.4 1.35l2.6-2.6A9 9 0 0 0 .9 5.2l3 2.3C4.6 5.4 6.6 3.6 9 3.6Z"
      />
    </svg>
  );
}

// Rendered as plain content inside RootPage's single, permanently-mounted
// <Page> — never its own <Page>/<View>. Framework7 mounts routed pages
// through its own imperative page loader tied to the router's lifecycle;
// swapping between separate <View>s for logged-out/onboarding/main states
// left orphaned DOM behind (confirmed: Login and Holdings content both
// showing up in the page at once). Gating instead happens as a plain
// conditional inside one stable page — see Root.tsx.
export default function LoginContent() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setPending(true);
    setError(null);
    try {
      await store.dispatch("loginWithGoogle", undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-panel">
      <div className="login-mark" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 21l6-7 5 4 7-10" />
          <circle cx="22" cy="8" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      </div>

      <div className="login-word">Portifo</div>
      <p className="login-tag">
        Every currency, every account,
        <br />
        one shared ledger.
      </p>

      <div className="login-cta">
        <button type="button" className="btn btn-google" onClick={handleLogin} disabled={pending}>
          {pending ? <span className="inline-spinner" /> : <GoogleIcon />}
          Continue with Google
        </button>
        {error && <span className="field-error">{error}</span>}
      </div>

      <p className="login-fine">Tracks manually entered transactions &amp; balances · no bank login required</p>
    </div>
  );
}
