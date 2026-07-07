import { IonButton, IonButtons, IonDatetime, IonHeader, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { useRef } from "react";

const NEAR_STYLE = { opacity: "0.7", color: "var(--fg-2)" };
const FAR_STYLE = { opacity: "", color: "" };

// Ionic's ion-datetime wheel only exposes two shadow parts — wheel-item and
// wheel-item active — so the DS 3-tier fade (far / near / selected, see
// .wheel-row.near in docs/design-system.html) has no CSS-only way to reach
// the rows immediately next to the selection. This walks each picker column
// and inline-styles the "near" siblings whenever the active option changes
// (including live during a scroll drag, since Ionic toggles the same
// .option-active class before the value commits).
function applyNearTier(column: Element) {
  const options = Array.from(column.children).filter(
    (el): el is HTMLElement => el.tagName === "ION-PICKER-COLUMN-OPTION",
  );
  options.forEach((el) => Object.assign(el.style, FAR_STYLE));
  const activeIndex = options.findIndex((el) => el.classList.contains("option-active"));
  if (activeIndex === -1) return;
  const prev = options[activeIndex - 1];
  const next = options[activeIndex + 1];
  if (prev) Object.assign(prev.style, NEAR_STYLE);
  if (next) Object.assign(next.style, NEAR_STYLE);
}

function styleWheel(root: ShadowRoot) {
  // Ionic's iOS picker paints .picker-before/.picker-after veils over the top
  // 83px and bottom 84px of the wheel, and their gradients never drop below
  // 0.8 alpha — every non-selected row sits under a near-opaque surface wash,
  // which flattens the DS 3-tier fade into "selected vs ghost". Hide them;
  // .wheel-stage::before/::after draw the DS 52px gradients instead.
  const picker = root.querySelector("ion-picker");
  picker?.shadowRoot?.querySelectorAll<HTMLElement>(".picker-before, .picker-after").forEach((el) => {
    el.style.display = "none";
  });
  root.querySelectorAll("ion-picker-column").forEach(applyNearTier);
}

// IonModal lazily mounts its content, so a useEffect keyed on `isOpen` can
// fire before the ion-datetime node exists. A callback ref sidesteps that:
// it runs exactly when the node attaches (open) and again with null when it
// detaches (close), so setup/teardown of the MutationObserver stays in sync
// with the element's actual lifecycle instead of guessing at timing.
// One observer on the datetime's shadow root (rather than per-column) also
// covers slower devices where Stencil renders the picker columns after the
// ref has already fired — their arrival is itself a mutation we react to.
function watchWheel(el: HTMLIonDatetimeElement | null, observerRef: React.MutableRefObject<MutationObserver | null>) {
  observerRef.current?.disconnect();
  observerRef.current = null;
  if (!el?.shadowRoot) return;

  const root = el.shadowRoot;
  styleWheel(root);
  const observer = new MutationObserver(() => styleWheel(root));
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  observerRef.current = observer;
}

// Extracted from AddTransactionPage's previously-inline date bottom sheet so
// it can be reused as a standalone {isOpen,value,onSelect,onClose} picker.
function DateSheet({
  isOpen,
  value,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const wheelObserver = useRef<MutationObserver | null>(null);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]} className="auto-sheet">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Date</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={onClose}>
              Done
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      {/* DS .wheel-picker: hairline selection band instead of a filled
          highlight box — the band overlays a transparent-highlight wheel.
          Plain div (not IonContent): the sheet is auto-height and hugs the
          wheel like the DS panel. */}
      <div className="wheel-stage">
        <IonDatetime
          ref={(el) => watchWheel(el, wheelObserver)}
          presentation="date"
          preferWheel
          value={value}
          onIonChange={(e) => {
            const v = e.detail.value;
            if (typeof v === "string") onSelect(v);
          }}
        />
        <div className="wheel-band" aria-hidden="true" />
      </div>
    </IonModal>
  );
}

export default DateSheet;
