import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setupIonicReact } from "@ionic/react";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils that can be commented out */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* Dark mode support — class-based so Settings can override the system
   preference; src/lib/theme.ts toggles `ion-palette-dark` on <html>. */
import "@ionic/react/css/palettes/dark.class.css";

/* Repoints Ionic's palette to docs/design-system.html's tokens — import after
   the Ionic dark palette above so these values win on the shared :root vars. */
import "./theme/variables.css";

import "./index.css";
import App from "./App.tsx";
import { initTheme } from "./lib/theme";
import { initPreventEdgeSwipeBack } from "./lib/preventEdgeSwipeBack";
import { initDisableAncestorOutletSwipe } from "./lib/disableAncestorOutletSwipe";

// Portifo targets an iOS home-screen PWA, so force iOS mode regardless of
// the host browser/platform rather than auto-detecting.
setupIonicReact({ mode: "ios" });

// Apply the stored appearance (system/light/dark) before first paint.
initTheme();

// Block WKWebView's native edge-swipe-back gesture (see the module for why).
initPreventEdgeSwipeBack();

// Stop ancestor IonRouterOutlets from also owning a swipe-back gesture that
// only the innermost (per-tab) outlet should handle — must run before
// render so its MutationObserver is watching from the very first outlet.
initDisableAncestorOutletSwipe();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
