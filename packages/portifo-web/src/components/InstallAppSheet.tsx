import { IonModal } from "@ionic/react";
import type { ReactNode } from "react";
import type { InstallPlatform } from "../lib/pwaInstall";
import { AddHomeGlyphIcon, ListDivider, MenuKebabGlyphIcon, ShareGlyphIcon } from "./ds";

type Step = { icon: ReactNode; text: ReactNode };

const IOS_STEPS: Step[] = [
  {
    icon: <ShareGlyphIcon />,
    text: (
      <>
        Tap the <strong>Share</strong> icon in Safari's toolbar
      </>
    ),
  },
  {
    icon: <AddHomeGlyphIcon />,
    text: (
      <>
        Scroll down and tap <strong>Add to Home Screen</strong>
      </>
    ),
  },
  {
    icon: <AddHomeGlyphIcon />,
    text: (
      <>
        Tap <strong>Add</strong> to confirm
      </>
    ),
  },
];

const ANDROID_STEPS: Step[] = [
  {
    icon: <MenuKebabGlyphIcon />,
    text: <>Tap the menu icon in Chrome's toolbar</>,
  },
  {
    icon: <AddHomeGlyphIcon />,
    text: (
      <>
        Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>)
      </>
    ),
  },
  {
    icon: <AddHomeGlyphIcon />,
    text: (
      <>
        Tap <strong>Install</strong> to confirm
      </>
    ),
  },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <div className="install-steps">
      {steps.map((step, i) => (
        <div className="install-step" key={i}>
          <span className="install-step-num">{i + 1}</span>
          <span className="install-step-text">{step.text}</span>
          <span className="install-step-icon">{step.icon}</span>
        </div>
      ))}
    </div>
  );
}

// Install-guide sheet (DS .sheet-panel, same auto-height shape as
// ActionSheetModal) — walks the user through the OS-native "add to home
// screen" flow, since there's no programmatic install trigger on iOS and
// Chrome's beforeinstallprompt is unreliable enough not to depend on.
function InstallAppSheet({ isOpen, onClose, platform }: { isOpen: boolean; onClose: () => void; platform: InstallPlatform }) {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} initialBreakpoint={1} breakpoints={[0, 1]} className="auto-sheet">
      <div className="sheet-panel-head">
        <span className="sheet-panel-title">Add to Home Screen</span>
        <span className="sheet-panel-sub">Install Portifo as an app</span>
      </div>
      <div className="sheet-panel-body">
        {platform === "ios" && <StepList steps={IOS_STEPS} />}
        {platform === "android" && <StepList steps={ANDROID_STEPS} />}
        {platform === "other" && (
          <>
            <ListDivider label="iPhone · Safari" />
            <StepList steps={IOS_STEPS} />
            <ListDivider label="Android · Chrome" />
            <StepList steps={ANDROID_STEPS} />
          </>
        )}
        <button type="button" className="action-cancel" onClick={onClose}>
          Got it
        </button>
      </div>
    </IonModal>
  );
}

export default InstallAppSheet;
