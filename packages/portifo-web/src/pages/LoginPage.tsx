import { IonContent, IonPage, IonSpinner } from "@ionic/react";
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import InstallAppSheet from "../components/InstallAppSheet";
import { InstallGlyphIcon } from "../components/ds";
import { detectInstallPlatform, isStandaloneDisplay } from "../lib/pwaInstall";

// Same Google "G" mark portifo-web's LoginScreen renders inline.
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

const REPO_URL = "https://github.com/meysius/portifo";

// GitHub's octocat mark, monochrome — it inherits the row's colour rather than
// carrying brand colour the way the Google "G" does.
function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const platform = useMemo(detectInstallPlatform, []);
  const alreadyInstalled = useMemo(isStandaloneDisplay, []);

  const handleLogin = async () => {
    setPending(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Google sign-in failed", { color: "danger" });
    } finally {
      setPending(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="login-content">
        <div className="login-screen">
          {/* Brand line at the top, copy centred, CTA pinned to the bottom —
              the pre-shell composition Login and Onboarding share. */}
          <div className="login-brand">Portifo</div>

          <div className="login-mid">
          <div className="login-mark" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
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
          </div>

          <div className="login-bottom">
          <div className="login-cta">
            <button type="button" className="btn btn-google" onClick={handleLogin} disabled={pending}>
              {pending ? <IonSpinner name="crescent" className="inline-spinner" /> : <GoogleIcon />}
              Continue with Google
            </button>

            {!alreadyInstalled && (
              <button type="button" className="btn btn-secondary" onClick={() => setShowInstallGuide(true)}>
                <InstallGlyphIcon />
                Install App
              </button>
            )}
          </div>

          <p className="login-fine">Tracks manually entered transactions &amp; balances · no bank login required</p>

          {/* Open source, below a hairline: a footnote about the software, not a third
              auth choice. Opens in a new tab so a standalone PWA hands off to the
              browser instead of navigating the session away. */}
          <div className="login-oss">
            <p className="login-oss-body">
              <b>Portifo is open source.</b> Use this instance, or deploy your own.
            </p>
            <a
              className="login-oss-link"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon />
              github.com/meysius/portifo
            </a>
          </div>
          </div>
        </div>
      </IonContent>

      <InstallAppSheet isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} platform={platform} />
    </IonPage>
  );
}

export default LoginPage;
