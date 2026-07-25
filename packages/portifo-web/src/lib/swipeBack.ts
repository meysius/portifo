import { useIonRouter } from "@ionic/react";

// Who owns the back gesture on an iOS home-screen PWA.
//
// WKWebView runs its own native edge-swipe-back gesture (a screenshot-based
// animation, no API to turn it off) *underneath* Ionic's own swipe-back
// transition — that's the double-layer swipe bug
// (ionic-team/ionic-framework#29733). Only one of the two can own it, and
// the two strategies are mutually exclusive:
//
//   "ionic"  — the original approach here: kill the native gesture by
//              preventDefault()-ing every edge touchstart (see
//              lib/preventEdgeSwipeBack.ts) and let Ionic animate. Nicer
//              animation (interactive parallax, navbar cross-fade), but it
//              cannot cover a swipe that starts *off* the glass: iOS' own
//              recognizer claims that touch before any DOM touchstart
//              fires, so the native pop happens anyway and races Ionic's.
//
//   "native" — the fix suggested in
//              https://github.com/ionic-team/ionic-framework/issues/29733#issuecomment-2689335413:
//              give the gesture to WKWebView and stop Ionic from animating
//              backwards navigations at all (Ionic still swaps the pages,
//              just instantly, underneath the native snapshot animation).
//              Nothing depends on cancelling the native gesture, so the
//              off-glass swipe stops being a special case.
export const SWIPE_BACK_OWNER: "ionic" | "native" = "native";

// Only relevant when SWIPE_BACK_OWNER === "native". The linked comment drops
// Ionic's animation for *every* back navigation on iOS, which also flattens
// in-app backs (IonBackButton, history.goBack()) into an instant cut with no
// native snapshot animation underneath to cover it. Those are distinguishable:
// an app-initiated back always goes through the react-router history object
// (Ionic's own IonBackButton handler ends up calling history.goBack() too),
// whereas WKWebView's gesture only ever emits a bare popstate. So we keep
// Ionic's animation for programmatic navigation and drop it only for the
// gesture. Set to false to get the linked comment's behaviour verbatim.
export const KEEP_APP_BACK_ANIMATION = true;

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports a desktop Mac UA; maxTouchPoints separates it from a
  // real Mac, where none of this applies.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// How long after a programmatic history call a back transition still counts
// as app-initiated. history.goBack() dispatches its popstate asynchronously,
// and Ionic's routeInfo update + re-render land a tick after that; a native
// edge swipe takes far longer than this to even complete a drag, so there's
// no realistic overlap.
const APP_NAV_WINDOW_MS = 500;

let lastAppNavAt = 0;

function isAppInitiatedNav(): boolean {
  return performance.now() - lastAppNavAt < APP_NAV_WINDOW_MS;
}

type HistoryLike = Record<string, unknown>;

const NAV_METHODS = ["push", "replace", "go", "goBack", "goForward"] as const;

const INSTALLED = new WeakSet<object>();

/* Marks every navigation the app itself performs, so a back transition can
   be told apart from WKWebView's native gesture (which never runs any of
   these). Ionic calls `history.goBack` unbound, so the wrappers must not
   rely on `this`. Installed from components/NavIntentTracker.tsx. */
export function installAppNavTracker(history: HistoryLike) {
  if (SWIPE_BACK_OWNER !== "native" || !KEEP_APP_BACK_ANIMATION) return;
  if (INSTALLED.has(history)) return;
  INSTALLED.add(history);

  for (const name of NAV_METHODS) {
    const original = history[name];
    if (typeof original !== "function") continue;
    const fn = original as (...args: unknown[]) => unknown;
    history[name] = (...args: unknown[]) => {
      lastAppNavAt = performance.now();
      return fn.apply(history, args);
    };
  }
}

/* The `animated` prop for an IonRouterOutlet. Always true unless we've handed
   backwards navigation to WKWebView on an actual iOS device. */
export function useOutletAnimated(): boolean {
  const { routeInfo } = useIonRouter();

  if (SWIPE_BACK_OWNER !== "native") return true;
  if (routeInfo.routeDirection !== "back") return true;
  if (!isIOS()) return true;
  return KEEP_APP_BACK_ANIMATION && isAppInitiatedNav();
}
