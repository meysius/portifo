import { PLOT_H, PLOT_TOP } from "../lib/chartAxis";
import type { ValueTick } from "../lib/chartAxis";

// The value scale behind a line chart (see lib/chartAxis): a hairline at the
// top of each band, running under the label column as Apple's do, its value
// just beneath it at the right, a rule closing the plot off from the labels,
// and a firmer baseline the low sits on. Solid, not the study's dashes: on
// --ds-line a dash all but vanishes, and the bands are what make a high or a
// low easy to place.
export default function ValueGrid({ ticks, width, plotW }: { ticks: ValueTick[]; width: number; plotW: number }) {
  return (
    <g aria-hidden="true">
      <path
        d={ticks.map((t) => `M0 ${t.y}H${width}`).join("") + (ticks.length ? `M${plotW} ${PLOT_TOP}V${PLOT_H}` : "")}
        fill="none"
        stroke="var(--ds-line)"
        strokeWidth={1}
      />
      <path d={`M0 ${PLOT_H - 0.5}H${width}`} fill="none" stroke="var(--ds-muted)" strokeWidth={1} />
      {ticks.map((t) => (
        <text key={t.y} className="chart-axis-label" x={width} y={t.y} dy="1.2em" textAnchor="end">
          {t.label}
        </text>
      ))}
    </g>
  );
}
