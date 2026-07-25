import { IonApp } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import AuthGate from "./AuthGate";
import HistoryGuard from "./components/HistoryGuard";
import NavIntentTracker from "./components/NavIntentTracker";

function App() {
  return (
    <IonApp>
      <ToastProvider>
        <IonReactRouter>
          {/* Must be inside IonReactRouter so useHistory() resolves to the
              same history instance Ionic itself navigates with — see
              HistoryGuard.tsx for what this blocks and why. */}
          <HistoryGuard />
          {/* Same reason — it wraps that history instance's navigation
              methods to tell app-initiated backs from WKWebView's gesture. */}
          <NavIntentTracker />
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </IonReactRouter>
      </ToastProvider>
    </IonApp>
  );
}

export default App;
