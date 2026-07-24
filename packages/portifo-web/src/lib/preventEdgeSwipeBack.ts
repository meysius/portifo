// On an iOS home-screen PWA, WKWebView has its own native "swipe from the
// left/right edge to go back/forward" gesture, driven by a screenshot-based
// animation that runs independently of (and visually underneath) Ionic's own
// swipe-back animation — the double-layer swipe bug. Safari's gesture only
// arms when a touch starts at the physical screen edge, and preventDefault()
// on that touchstart is the only way to stop it (there's no API for it).
//
// This has to be unconditional: Ionic's own swipe-back gesture is driven off
// the same touch events and keeps working fine even when this listener calls
// preventDefault() first — confirmed on-device. So there's no need to gate
// on whether Ionic itself would handle the gesture (a previous version of
// this file did, to be safe, but that's unnecessary caution).
//
// Chromium's equivalent two-finger/overscroll history navigation is instead
// handled in index.css via `overscroll-behavior-x: none`, which Chrome
// respects but Safari ignores — hence this listener existing at all.
const EDGE_GUARD = 16;

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0];
  if (!touch) return;
  if (touch.clientX <= EDGE_GUARD || touch.clientX >= window.innerWidth - EDGE_GUARD) {
    e.preventDefault();
  }
}

/* Installs the edge-swipe guard; called once in main.tsx before render. */
export function initPreventEdgeSwipeBack() {
  document.addEventListener("touchstart", onTouchStart, { passive: false });
}
