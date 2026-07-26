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

/* Self-hosted Inter / Public Sans / JetBrains Mono — no network font fetch, so
   a cold offline launch of the installed PWA still has its type. */
import "./theme/fonts.css";

/* Repoints Ionic's palette to the design language in docs/new-design-system/ —
   import after the Ionic dark palette above so these values win on the shared
   :root vars. */
import "./theme/variables.css";

import "./index.css";
import App from "./App.tsx";
import { initTheme } from "./lib/theme";
import { initPreventEdgeSwipeBack } from "./lib/preventEdgeSwipeBack";
import { initDisableAncestorOutletSwipe } from "./lib/disableAncestorOutletSwipe";
import { SWIPE_BACK_OWNER } from "./lib/swipeBack";

// Portifo targets an iOS home-screen PWA, so force iOS mode regardless of
// the host browser/platform rather than auto-detecting.
//
// Ionic's own swipe-back gesture is off entirely under the "native" strategy
// (see lib/swipeBack.ts): with `animated={false}` on a back transition, the
// outlet's progress callback never receives an animation, so a gesture that
// did start would visually swap the pages mid-drag and then never commit the
// navigation — the gesture and the disabled animation only make sense together.
setupIonicReact({ mode: "ios", swipeBackEnabled: SWIPE_BACK_OWNER === "ionic" });

// Apply the stored appearance (system/light/dark) before first paint.
initTheme();

if (SWIPE_BACK_OWNER === "ionic") {
  // Block WKWebView's native edge-swipe-back gesture (see the module for
  // why). Under the "native" strategy that gesture *is* the back navigation,
  // so it must stay alive.
  initPreventEdgeSwipeBack();

  // Stop ancestor IonRouterOutlets from also owning a swipe-back gesture that
  // only the innermost (per-tab) outlet should handle — must run before
  // render so its MutationObserver is watching from the very first outlet.
  // Moot when no outlet owns a swipe gesture at all.
  initDisableAncestorOutletSwipe();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
