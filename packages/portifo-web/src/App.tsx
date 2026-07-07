import { IonApp } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import AuthGate from "./AuthGate";
import HistoryGuard from "./components/HistoryGuard";

function App() {
  return (
    <IonApp>
      <ToastProvider>
        <IonReactRouter>
          {/* Must be inside IonReactRouter so useHistory() resolves to the
              same history instance Ionic itself navigates with — see
              HistoryGuard.tsx for what this blocks and why. */}
          <HistoryGuard />
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </IonReactRouter>
      </ToastProvider>
    </IonApp>
  );
}

export default App;
