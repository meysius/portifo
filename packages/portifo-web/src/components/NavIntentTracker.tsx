import { useEffect } from "react";
import { useHistory } from "react-router-dom";
import { installAppNavTracker } from "../lib/swipeBack";

// Must be rendered inside IonReactRouter so useHistory() resolves to the same
// history instance Ionic itself navigates with — that's the whole point, see
// lib/swipeBack.ts. No-op unless the native swipe-back strategy is active.
export default function NavIntentTracker() {
  const history = useHistory();

  useEffect(() => {
    installAppNavTracker(history as unknown as Record<string, unknown>);
  }, [history]);

  return null;
}
