// Now that every tab-reachable detail route is nested inside that tab's own
// IonRouterOutlet (see Tabs.tsx), there are up to 3 IonRouterOutlets nested
// inside each other at once: AuthGate's (just renders Tabs), Tabs' own (just
// switches between Portfolio/Accounts/Transactions/Settings), and each tab's
// own leaf outlet (where real push/pop navigation — asset detail, cash
// detail, etc. — actually happens). Only that innermost outlet should ever
// own a swipe-back gesture.
//
// In practice all three report swipeHandler.canStart() === true during a
// swipe back into a tab root, because their outer Route matches are
// non-exact prefixes (`path="/tabs/portfolio"`, not `exact`) — a case Ionic
// itself documents as a "design defect" in view-item matching for
// non-exact/render-based routes. Since @ionic/core's ion-router-outlet
// starts its OWN independent swipe gesture per instance whenever its
// swipeHandler is set, having all 3 outlets simultaneously "own" the same
// touch produces 3 competing page transitions rendered on top of each other
// (visually: multiple stacked/ghosted pages during the drag), and leaves
// Ionic's virtual navigation state and the real history stack out of sync
// after release — confirmed concretely: Ionic's own controlled back
// navigation uses history.replace() in some cases (not a true pop), so a
// raw history.back() landing on top of that replaced state skips a level
// that visually looked like a distinct page.
//
// A previous version of this fix re-gated canStart() reactively on every
// edge touchstart. That's too late for the case that matters most: on iOS,
// a swipe that starts on the bezel/off-screen can be claimed by the native
// OS edge-gesture recognizer before any DOM touchstart ever fires on the
// page, so a touch-triggered fix never runs in time to gate the ancestor
// outlets for that gesture. Fixed here by intercepting the `swipeHandler`
// property setter itself (defined on ion-router-outlet's prototype by
// Stencil, shared by every instance) so the gating applies the instant
// anything assigns a handler — mount, remount, React StrictMode's dev-only
// double-mount replay, whatever — with no dependency on any touch event
// ever occurring. We forward through to Stencil's real setter (rather than
// fully replacing the property) so its own swipeHandlerChanged() watcher
// (which calls the underlying gesture.enable(...)) keeps firing normally;
// only the handler's own canStart() gets wrapped.
//
// The "is this outlet currently an ancestor of another outlet" check is
// evaluated fresh inside the wrapped canStart() on every call, not decided
// once at patch time — the same patch is safe to apply to every outlet
// (leaf outlets included), since a leaf outlet's wrapped canStart() just
// evaluates to "true, defer to the real canStart()" whenever it's actually
// the innermost one at gesture-start time.
function isAncestorOfAnotherOutlet(outlet: Element): boolean {
  const outlets = document.querySelectorAll("ion-router-outlet");
  for (const other of outlets) {
    if (other !== outlet && outlet.contains(other)) return true;
  }
  return false;
}

interface SwipeHandler {
  canStart(): boolean;
}

const PATCHED = new WeakSet<Element>();

function patchOutlet(outlet: Element) {
  if (PATCHED.has(outlet)) return;

  // Stencil defines an OWN accessor per element instance during hydration
  // here (not just a shared one on the class prototype) — check the
  // instance first, since that's the one actually invoked at runtime, and
  // only fall back to the prototype chain if hydration hasn't happened yet.
  let descriptor = Object.getOwnPropertyDescriptor(outlet, "swipeHandler");
  if (!descriptor) {
    let proto: object | null = Object.getPrototypeOf(outlet);
    while (proto && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(proto, "swipeHandler");
      proto = Object.getPrototypeOf(proto);
    }
  }
  if (!descriptor?.get || !descriptor.set) return;
  PATCHED.add(outlet);

  const originalGet = descriptor.get.bind(outlet);
  const originalSet = descriptor.set.bind(outlet);

  function gate(handler: SwipeHandler | undefined): SwipeHandler | undefined {
    if (!handler) return handler;
    const originalCanStart = handler.canStart.bind(handler);
    return { ...handler, canStart: () => !isAncestorOfAnotherOutlet(outlet) && originalCanStart() };
  }

  Object.defineProperty(outlet, "swipeHandler", {
    configurable: true,
    get: originalGet,
    set(handler: SwipeHandler | undefined) {
      originalSet(gate(handler));
    },
  });

  // A handler may already have been assigned (via the original, unwrapped
  // setter) before this patch ran — StackManager only assigns it once per
  // mount, so without this, an already-set handler would never pass
  // through our new setter at all and would stay unwrapped forever.
  const existing = originalGet();
  if (existing) originalSet(gate(existing));
}

function patchAllOutlets() {
  document.querySelectorAll("ion-router-outlet").forEach(patchOutlet);
}

/* Installs the patch; called once in main.tsx before render. Patches every
   outlet present now, and watches for outlets created later (each tab
   switch mounts a fresh leaf outlet). */
export function initDisableAncestorOutletSwipe() {
  patchAllOutlets();
  new MutationObserver(patchAllOutlets).observe(document.body, { childList: true, subtree: true });
}
