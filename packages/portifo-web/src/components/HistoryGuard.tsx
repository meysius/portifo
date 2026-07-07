import { useEffect } from "react";
import { useHistory } from "react-router-dom";

// Ionic's own swipe-back gesture (StackManager's onEnd) can independently
// complete a *second* "go back" shortly after a native WKWebView edge-swipe
// gesture already popped browser history once for the same physical touch
// (confirmed on-device via a nav-history logger: a real popstate correctly
// lands on the previous page, then ~400ms later Ionic's own
// onEnd -> handleNavigateBack -> handleNavigate fires a second, redundant
// history.replace()). At that point routeInfo.pushedByRoute is already
// gone, so Ionic's internal fallback hardcodes the destination to bare "/"
// - a path this app never treats as real (AuthGate immediately redirects
// any visit to "/" onward to /tabs/portfolio, which is why the symptom was
// always landing on Portfolio regardless of which tab the user started
// from). Blocking any transition that targets exactly "/" turns that stray
// fallback into a no-op instead of a visible double-pop.
//
// history.block()'s prompt callback returning `false` (not a string)
// cancels the transition silently - no window.confirm() dialog, and the
// blocked history.replace() call returns before ever notifying listeners,
// so Ionic's own handleHistoryChange never runs for it. That's not quite a
// full no-op on Ionic's side, though: handleNavigate sets its private
// incomingRouteParams *before* calling history.replace(), and since
// handleHistoryChange (the only thing that clears that field) never fires
// for a blocked call, that stale routeAction/pathname would otherwise
// linger and get merged into whatever the user navigates to *next*
// (handleNavigate does Object.assign onto the existing object, not a
// fresh one). Deferring a same-path replace() immediately after a block
// gives Ionic a completely normal, unblocked history event to react to,
// which clears that stale bookkeeping through its own real
// handleHistoryChange cycle (it short-circuits harmlessly there since the
// "leaving" and "new" pathnames are identical).
export default function HistoryGuard() {
  const history = useHistory();

  useEffect(
    () =>
      history.block((location) => {
        if (location.pathname !== "/") return undefined;
        setTimeout(() => {
          history.replace(history.location.pathname + history.location.search);
        }, 0);
        return false;
      }),
    [history],
  );

  return null;
}
