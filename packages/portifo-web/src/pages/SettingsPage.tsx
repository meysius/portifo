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
import { ChevronRightIcon, ListDivider, MemberInitial, PlusIcon, StackIcon, roleLabel } from "../components/ds";
import ActionSheetModal from "../components/ActionSheetModal";
import AddPortfolioModal from "../components/AddPortfolioModal";
import { setThemePreference, useThemePreference, type ThemePreference } from "../lib/theme";
import { enablePushNotifications, isPushSupported } from "../lib/push";
import { sendTestPush } from "../api/push";

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
  const { portfolios, activePortfolio, switchPortfolio, portfolioDetail } = usePortfolioData();
  const { showToast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [addPortfolioOpen, setAddPortfolioOpen] = useState(false);
  const otherPortfolios = portfolios.filter((p) => p.id !== activePortfolio?.id);
  const theme = useThemePreference();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    isPushSupported() ? Notification.permission : "unsupported",
  );
  const [enablingPush, setEnablingPush] = useState(false);
  const [sendingTestPush, setSendingTestPush] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      showToast("Failed to log out", { color: "danger" });
      setLoggingOut(false);
    }
  };

  const handleEnablePush = async () => {
    setEnablingPush(true);
    try {
      await enablePushNotifications();
      setNotifPermission("granted");
      showToast("Notifications enabled");
    } catch {
      setNotifPermission(Notification.permission);
      showToast("Couldn't enable notifications", { color: "danger" });
    } finally {
      setEnablingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    setSendingTestPush(true);
    try {
      await sendTestPush();
      showToast("Test notification sent");
    } catch {
      showToast("Couldn't send test notification", { color: "danger" });
    } finally {
      setSendingTestPush(false);
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

        {/* Account -> Portfolio -> Appearance -> Log Out: identity, then what you
            are looking at, then how it looks, then the way out. */}
        <ListDivider label="Account" />
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

        <ListDivider
          label="Portfolio"
          meta={portfolios.length > 1 ? `${portfolios.length} portfolios` : undefined}
        />
        {portfolioDetail && (
          <IonList inset>
            <IonItem button detail={false} onClick={() => history.push(`${tabBase}/portfolio`)}>
              <IonAvatar slot="start" className="glyph glyph-stock">
                <StackIcon />
              </IonAvatar>
              <IonLabel className="sub-mono">
                <h2>{portfolioDetail.name}</h2>
                <p>
                  {otherPortfolios.length > 0 && "Active · "}
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
            {/* The other portfolios switch in place — no chevron, nothing is
                pushed (rule 09); the switch lands on the Portfolio tab. */}
            {otherPortfolios.map((p) => (
              <IonItem key={p.id} button detail={false} onClick={() => switchPortfolio(p.id)}>
                <IonAvatar slot="start" className="glyph glyph-stock">
                  <StackIcon />
                </IonAvatar>
                <IonLabel>
                  <h2>{p.name}</h2>
                  <p>Tap to switch</p>
                </IonLabel>
              </IonItem>
            ))}
            <IonItem button detail={false} onClick={() => setAddPortfolioOpen(true)}>
              <IonAvatar slot="start" className="glyph glyph-cash">
                <PlusIcon />
              </IonAvatar>
              <IonLabel>
                <h2>New Portfolio</h2>
                <p>Its own accounts, members and onboarding</p>
              </IonLabel>
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

        <ListDivider label="Notifications" />
        <div className="btn-stack">
          {notifPermission === "granted" ? (
            <button type="button" className="btn btn-secondary" onClick={handleSendTestPush} disabled={sendingTestPush}>
              Send Test Notification
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEnablePush}
              disabled={enablingPush || notifPermission === "unsupported" || notifPermission === "denied"}
            >
              {notifPermission === "denied"
                ? "Notifications Blocked"
                : notifPermission === "unsupported"
                  ? "Notifications Unsupported"
                  : "Enable Notifications"}
            </button>
          )}
        </div>

        <div className="btn-stack">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setLogoutConfirmOpen(true)}
            disabled={loggingOut}
          >
            {loggingOut ? "Logging Out…" : "Log Out"}
          </button>
        </div>

        <ActionSheetModal
          isOpen={logoutConfirmOpen}
          onClose={() => setLogoutConfirmOpen(false)}
          title="Log Out"
          subtitle="Sign back in with Google any time"
          actions={[{ label: "Log Out", onClick: handleLogout }]}
        />
        <AddPortfolioModal isOpen={addPortfolioOpen} onClose={() => setAddPortfolioOpen(false)} />
      </IonContent>
    </IonPage>
  );
}

export default SettingsPage;
