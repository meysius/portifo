import {
  IonAvatar,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useState } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useToast } from "../context/ToastContext";
import { ChevronRightIcon, ListDivider, MemberInitial, StackIcon, roleLabel } from "../components/ds";
import { setThemePreference, useThemePreference, type ThemePreference } from "../lib/theme";

// Settings (design-system Screens section): the profile row is .detail-head's
// symrow shape turned sideways — a 56px .glyph-member-lg initial avatar in
// place of .detail-sym, name/email stacked beside it, "Google Account" as a
// plain .type-tag reporting the app's one sign-in method rather than
// inviting a change. The Portfolio row is Settings' one job beyond that:
// what's active and who's on it, not a second portfolio switcher — that
// stays on the Portfolio tab's own topbar.
function SettingsPage() {
  const history = useHistory();
  const { tabBase } = useTabBase();
  const { user, logout } = useAuth();
  const { portfolioDetail } = usePortfolioData();
  const { showToast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const theme = useThemePreference();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      showToast("Failed to log out", { color: "danger" });
      setLoggingOut(false);
    }
  };

  return (
    <IonPage className="tab-root-page">
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="settings-profile">
          <div className="glyph glyph-member glyph-member-lg">
            <MemberInitial label={user?.name ?? user?.email ?? ""} />
          </div>
          <div className="settings-profile-info">
            <span className="settings-profile-name">{user?.name}</span>
            <span className="settings-profile-email">{user?.email}</span>
            <span className="type-tag" style={{ width: "fit-content" }}>
              Google Account
            </span>
          </div>
        </div>

        <ListDivider label="Portfolio" />
        {portfolioDetail && (
          <IonList inset>
            <IonItem button detail={false} onClick={() => history.push(`${tabBase}/portfolio`)}>
              <IonAvatar slot="start" className="glyph glyph-stock">
                <StackIcon />
              </IonAvatar>
              <IonLabel className="sub-mono">
                <h2>{portfolioDetail.name}</h2>
                <p>
                  {portfolioDetail.memberCount} member{portfolioDetail.memberCount === 1 ? "" : "s"}
                </p>
              </IonLabel>
              <span slot="end" className="type-tag">
                {roleLabel(portfolioDetail.role)}
              </span>
              <span slot="end" className="row-chevron" aria-hidden="true">
                <ChevronRightIcon />
              </span>
            </IonItem>
          </IonList>
        )}

        <ListDivider label="Appearance" />
        <IonSegment
          value={theme}
          onIonChange={(e) => setThemePreference(e.detail.value as ThemePreference)}
          className="seg-card"
        >
          <IonSegmentButton value="system">
            <IonLabel>System</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="light">
            <IonLabel>Light</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="dark">
            <IonLabel>Dark</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        <div className="btn-stack">
          <button type="button" className="btn btn-secondary" onClick={handleLogout} disabled={loggingOut}>
            Log Out
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default SettingsPage;
