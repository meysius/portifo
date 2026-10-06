import { useState } from "react";

// TEMPORARY diagnostics for the frosted top bar on iOS 27 — remove once fixed.
// Collects what the device actually laid out: the status-bar mode in effect
// (the top safe-area inset is ~0 under "default", ~59pt under
// "black-translucent"), the metas this build served, the viewport, the top
// bar's ancestry, and everything stacked or blurring over the top 160px.

declare const __BUILD__: string;

const short = (el: Element) => {
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 4) : [];
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls.length ? `.${cls.join(".")}` : ""}`;
};

function describe(el: Element) {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const parts = [short(el), `y=${Math.round(r.top)} h=${Math.round(r.height)} w=${Math.round(r.width)}`];
  if (s.position !== "static") parts.push(`pos=${s.position}`);
  if (s.zIndex !== "auto") parts.push(`z=${s.zIndex}`);
  if (s.backgroundColor !== "rgba(0, 0, 0, 0)") parts.push(`bg=${s.backgroundColor}`);
  if (s.backgroundImage !== "none") parts.push(`bgimg=${s.backgroundImage.slice(0, 60)}`);
  if (s.opacity !== "1") parts.push(`op=${s.opacity}`);
  const backdrop = s.getPropertyValue("backdrop-filter") || s.getPropertyValue("-webkit-backdrop-filter");
  if (backdrop && backdrop !== "none") parts.push(`backdrop=${backdrop}`);
  if (s.filter !== "none") parts.push(`filter=${s.filter}`);
  if (s.transform !== "none") parts.push(`transform=${s.transform}`);
  if (s.mixBlendMode !== "normal") parts.push(`blend=${s.mixBlendMode}`);
  if (s.visibility !== "visible") parts.push(`vis=${s.visibility}`);
  return parts.join(" ");
}

// env() only resolves inside CSS, so measure it on a probe.
function safeAreas() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);" +
    "margin-top:var(--ion-safe-area-top,0px)";
  document.body.appendChild(probe);
  const s = getComputedStyle(probe);
  const out = {
    top: s.paddingTop,
    right: s.paddingRight,
    bottom: s.paddingBottom,
    left: s.paddingLeft,
    ionTop: s.marginTop,
  };
  probe.remove();
  return out;
}

function collectDebugInfo(): string {
  const vv = window.visualViewport;
  const nav = [...document.querySelectorAll(".ds-navigation")].find((n) => n.getBoundingClientRect().height > 0);
  const ancestry: string[] = [];
  for (let el: Element | null = nav ?? null; el; el = el.parentElement) ancestry.push(describe(el));

  const w = window.innerWidth;
  const points: [number, number][] = [];
  for (const y of [2, 20, 40, 60, 80, 100, 120, 150]) for (const x of [20, Math.round(w / 2), w - 30]) points.push([x, y]);

  // Anything in the top band that could tint, blur or sit on top of the bar.
  const effects: string[] = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width === 0 || r.top > 160 || r.bottom < 0) continue;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    const backdrop = s.getPropertyValue("backdrop-filter") || s.getPropertyValue("-webkit-backdrop-filter");
    const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(s.backgroundColor)?.[1];
    const translucentBg = alpha != null && Number(alpha) > 0 && Number(alpha) < 1;
    if (
      (backdrop && backdrop !== "none") ||
      s.filter !== "none" ||
      Number(s.opacity) < 1 ||
      translucentBg ||
      s.position === "fixed" ||
      s.position === "sticky" ||
      s.mixBlendMode !== "normal"
    )
      effects.push(describe(el));
    if (effects.length >= 40) break;
  }

  const info = {
    build: typeof __BUILD__ === "string" ? __BUILD__ : "unknown",
    at: new Date().toISOString(),
    url: location.href,
    ua: navigator.userAgent,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone ?? null,
    displayMode: ["standalone", "fullscreen", "minimal-ui", "browser"].find(
      (m) => matchMedia(`(display-mode: ${m})`).matches,
    ),
    prefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
    themePref: localStorage.getItem("portifo.theme"),
    htmlClass: document.documentElement.className,
    metas: [...document.querySelectorAll("meta[name]")]
      .map((m) => m as HTMLMetaElement)
      .filter((m) => /theme-color|status-bar|viewport|web-app/.test(m.name))
      .map((m) => `${m.name}=${m.content}${m.media ? ` @${m.media}` : ""}`),
    viewport: {
      inner: `${window.innerWidth}x${window.innerHeight}`,
      outer: `${window.outerWidth}x${window.outerHeight}`,
      screen: `${screen.width}x${screen.height}`,
      dpr: window.devicePixelRatio,
      visual: vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} offsetTop=${vv.offsetTop} pageTop=${vv.pageTop} scale=${vv.scale}` : null,
      scrollY: window.scrollY,
      docScrollTop: document.scrollingElement?.scrollTop ?? null,
      appHeight: getComputedStyle(document.documentElement).getPropertyValue("--app-height") || null,
    },
    safeArea: safeAreas(),
    rootBg: {
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
    },
    navAncestry: ancestry,
    hits: points.map(([x, y]) => `(${x},${y}) ${document.elementsFromPoint(x, y).slice(0, 4).map(short).join(" > ")}`),
    topBandEffects: effects,
  };
  return JSON.stringify(info, null, 1);
}

// The button sits at the end of the page; the text area appears only when the
// clipboard refuses, so the report can still be copied by hand.
export default function DebugInfoButton() {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const [text, setText] = useState("");

  const copy = async () => {
    const report = collectDebugInfo();
    setText(report);
    try {
      await navigator.clipboard.writeText(report);
      setState("copied");
    } catch {
      setState("manual");
    }
  };

  return (
    <div className="debug-info">
      <button type="button" className="debug-info-button" onClick={copy}>
        {state === "copied" ? "Debug info copied ✓" : "Copy debug info"}
      </button>
      {state === "manual" && (
        <textarea className="debug-info-text" readOnly value={text} onFocus={(e) => e.currentTarget.select()} />
      )}
    </div>
  );
}
