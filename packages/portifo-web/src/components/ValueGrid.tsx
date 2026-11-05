import { LIVE_TAG_H, LIVE_TAG_PAD, PLOT_H, PLOT_TOP, liveTagWidth } from "../lib/chartAxis";
import type { ValueTick } from "../lib/chartAxis";

// A scale label sits just under its hairline; its glyphs centre about 10px
// down. One that would touch the live tag gives way to it.
const LABEL_MID = 10;
const LABEL_HALF = 6;

// The value scale behind a line chart (see lib/chartAxis): a hairline at the
// top of each band, running under the label column as Apple's do, its value
// just beneath it at the right, a rule closing the plot off from the labels,
// and a firmer baseline the low sits on. Solid, not the study's dashes: on
// --ds-line a dash all but vanishes, and the bands are what make a high or a
// low easy to place.
//
// `live` tags the latest price at its height (see liveLabel), right-aligned in
// the column, held inside the plot's height.
export default function ValueGrid({
  ticks,
  width,
  plotW,
  live,
}: {
  ticks: ValueTick[];
  width: number;
  plotW: number;
  live?: { y: number; label: string } | null;
}) {
  const tagW = live ? liveTagWidth(live.label) : 0;
  const tagY = live ? Math.min(Math.max(live.y - LIVE_TAG_H / 2, 0), PLOT_H - LIVE_TAG_H) : 0;
  const clear = (t: ValueTick) => !live || Math.abs(t.y + LABEL_MID - (tagY + LIVE_TAG_H / 2)) >= LIVE_TAG_H / 2 + LABEL_HALF;
  return (
    <g aria-hidden="true">
      <path
        d={ticks.map((t) => `M0 ${t.y}H${width}`).join("") + (ticks.length ? `M${plotW} ${PLOT_TOP}V${PLOT_H}` : "")}
        fill="none"
        stroke="var(--ds-line)"
        strokeWidth={1}
      />
      <path d={`M0 ${PLOT_H - 0.5}H${width}`} fill="none" stroke="var(--ds-muted)" strokeWidth={1} />
      {ticks.filter(clear).map((t) => (
        <text key={t.y} className="chart-axis-label" x={width} y={t.y} dy="1.2em" textAnchor="end">
          {t.label}
        </text>
      ))}
      {live && (
        <g className="chart-live-tag">
          <rect x={width - tagW} y={tagY} width={tagW} height={LIVE_TAG_H} rx={4} />
          <text x={width - LIVE_TAG_PAD} y={tagY + LIVE_TAG_H / 2} dy=".36em" textAnchor="end">
            {live.label}
          </text>
        </g>
      )}
    </g>
  );
}
