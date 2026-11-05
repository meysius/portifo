import { PLOT_H, PLOT_TOP } from "../lib/chartAxis";
import type { SessionSpans } from "../lib/chartAxis";

// Behind a 1D with extended hours: the stretches before the open and after the
// close, recessed in the subtle ground, so the regular session stands clear of
// the pre-market and after-hours trading either side of it.
export default function SessionShade({ spans }: { spans: SessionSpans | null }) {
  if (!spans) return null;
  return (
    <g aria-hidden="true">
      {spans.shade.map(([a, b]) => (
        <rect key={a} x={a} y={PLOT_TOP} width={b - a} height={PLOT_H - PLOT_TOP} fill="var(--ds-subtle)" />
      ))}
    </g>
  );
}
