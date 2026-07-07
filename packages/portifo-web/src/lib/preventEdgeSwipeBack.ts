// On an iOS home-screen PWA, WKWebView has its own native "swipe from the
// left edge to go back" gesture that pops raw browser history — independent
// of Ionic's own swipe-to-go-back animation. Ionic's IonTabButton always does
// a history.push when switching tabs (even though its own gesture correctly
// refuses to treat tab roots as backable), so that push leaves a real history
// entry for the native gesture to pop back to: switch Portfolio -> Transactions,
// swipe from the edge, and WKWebView's own back-forward-navigation-gesture
// (not Ionic's) lands you back on Portfolio.
//
// The standard fix is to intercept the touch at the edge and preventDefault()
// it — WKWebView's interactive pop gesture only engages if the page doesn't
// consume the touch. But calling preventDefault() unconditionally on every
// edge touchstart risks also suppressing Ionic's OWN swipe-to-go-back for
// genuinely pushed pages: Chromium (and WKWebView) can suppress the
// synthesized pointer events a touchstart would otherwise produce once its
// default is prevented, and Ionic's gesture recognizer is pointer-event-
// driven. So: only preventDefault when Ionic itself has nothing to swipe
// back to. Every IonRouterOutlet exposes swipeHandler.canStart() — true
// means Ionic will own this gesture (a real pushed route), false means
// Ionic is deliberately not treating it as backable (e.g. a tab switch) and
// would otherwise leave the native gesture free to act on the raw history
// stack instead.
const EDGE_PX = 24;

function ionicWillHandleGesture(): boolean {
  const outlets = document.querySelectorAll("ion-router-outlet");
  for (const outlet of outlets) {
    const swipeHandler = (outlet as unknown as { swipeHandler?: { canStart(): boolean } }).swipeHandler;
    if (swipeHandler?.canStart()) return true;
  }
  return false;
}

function onTouchStart(e: TouchEvent) {
  // Ancestor outlets are gated eagerly at mount time now, not reactively
  // here — see disableAncestorOutletSwipe.ts for why a touch-triggered gate
  // is too late for the case that actually matters (off-screen-starting
  // swipes never fire a touchstart in time). ionicWillHandleGesture below
  // can just trust the leaf outlet's answer directly.
  const x = e.touches[0]?.clientX;
  if (x !== undefined && x <= EDGE_PX && !ionicWillHandleGesture()) {
    e.preventDefault();
  }
}

/* Installs the edge-swipe guard; called once in main.tsx before render. */
export function initPreventEdgeSwipeBack() {
  document.addEventListener("touchstart", onTouchStart, { passive: false });
}
