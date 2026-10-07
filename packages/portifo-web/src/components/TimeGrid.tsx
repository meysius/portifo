import { AXIS_H, LABEL_INSET, PLOT_H, PLOT_TOP } from "../lib/chartAxis";
import type { TimeTick } from "../lib/chartAxis";

// The time scale beneath a line chart (see lib/chartAxis): a vertical guide
// where each hour, session, week, month or year begins, running down through
// the label row, with the unit's name just right of it, as Apple Stocks marks
// "30 · 1 · 2 · 5 · 6" across a week.
export default function TimeGrid({ ticks }: { ticks: TimeTick[] }) {
  return (
    <g aria-hidden="true">
      <path
        d={ticks.map((t) => `M${Math.round(t.x) + 0.5} ${PLOT_TOP}V${PLOT_H + AXIS_H}`).join("")}
        fill="none"
        stroke="var(--ds-line)"
        strokeWidth={1}
      />
      {ticks.map((t) => (
        <text key={t.x} className="chart-axis-label" x={t.x + LABEL_INSET} y={PLOT_H + AXIS_H / 2} dy=".36em">
          {t.label}
        </text>
      ))}
    </g>
  );
}
