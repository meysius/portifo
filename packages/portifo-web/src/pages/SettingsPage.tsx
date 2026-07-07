import { IonContent, IonHeader, IonLabel, IonPage, IonSegment, IonSegmentButton, IonTitle, IonToolbar } from "@ionic/react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ListDivider } from "../components/ds";
import { setThemePreference, useThemePreference, type ThemePreference } from "../lib/theme";

function SettingsPage() {
  const { user, logout } = useAuth();
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

        <div className="profile-card">
          <div className="profile-name">{user?.name}</div>
          <div className="profile-email">{user?.email}</div>
        </div>

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

        <div className="settings-body">
          <button type="button" className="btn btn-secondary" onClick={handleLogout} disabled={loggingOut}>
            Log Out
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default SettingsPage;
