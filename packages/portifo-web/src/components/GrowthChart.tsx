import { useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { EXTENDED_LABEL } from "../api/market";
import type { HistoryPoint, HistoryRange } from "../api/market";
import {
  AXIS_H,
  EXTENDED_OPACITY,
  PLOT_BOTTOM,
  PLOT_H,
  linePath,
  plotY,
  sessionSpans,
  timeAxis,
  valueAxis,
} from "../lib/chartAxis";
import { fmtCcy } from "../lib/fx";
import SessionShade from "./SessionShade";
import TimeGrid from "./TimeGrid";
import ValueGrid from "./ValueGrid";

// Portfolio's value over time, from design-poc/portfolio-overview.html and
// drawn the Apple Stocks way (see lib/chartAxis): the range picker above, a
// cobalt line over a wash, stretched from the range's low to its high over
// trading time only, a value scale at the right, a time scale beneath, the
// latest value as a dot, and a readout on demand (drag, hover, or arrow keys).
//
// 1D runs through the day's pre-market and after-hours trading, drawn as on a
// holding's chart (see HoldingChart). Those stretches value each holding at
// its latest trade; the total above the chart stays the regular session's.

const GROWTH_RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y", "5Y", "All"];
const CHART_H = PLOT_H + AXIS_H;

// 1W and 1M are intraday bars, so their readout names the hour too. 1D's
// names the session outside regular hours.
function growthLabel(point: HistoryPoint, range: HistoryRange) {
  const intraday = range === "1W" || range === "1M";
  const session = point.session ? ` · ${EXTENDED_LABEL[point.session]}` : "";
  return new Date(point.date).toLocaleString(
    "en-US",
    range === "1D"
      ? { hour: "numeric", minute: "2-digit" }
      : {
          month: "short",
          day: "numeric",
          year: ["1Y", "2Y", "5Y", "All"].includes(range) ? "numeric" : undefined,
          hour: intraday ? "numeric" : undefined,
          minute: intraday ? "2-digit" : undefined,
        },
  ) + session;
}

export default function GrowthChart({
  points,
  range,
  ccy,
  failed,
  onRange,
}: {
  points: HistoryPoint[];
  range: HistoryRange;
  ccy: string;
  failed: boolean;
  onRange: (r: HistoryRange) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const gradId = useId();

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const ready = n > 1 && width > 0;
  const last = n - 1;
  const values = points.map((p) => p.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scale = valueAxis(min, max);
  const plotW = width - scale.width;
  const xs = points.map((_, i) => (ready ? (i * plotW) / last : 0));
  const ys = values.map((v) => plotY(v, min, max));
  const path = ready ? linePath(xs, ys) : "";
  // On a 1D with extended hours: where the regular session runs, the line
  // through it alone, and the fill under it.
  const spans = ready
    ? sessionSpans(
        points.map((p) => p.session),
        xs,
        plotW,
      )
    : null;
  const regular = spans && spans.open >= 0 ? linePath(xs, ys, spans.open, spans.close) : "";
  const fill = !spans
    ? `${path} L${plotW},${PLOT_BOTTOM} L0,${PLOT_BOTTOM} Z`
    : regular
      ? `${regular} L${xs[spans.close].toFixed(1)},${PLOT_BOTTOM} L${xs[spans.open].toFixed(1)},${PLOT_BOTTOM} Z`
      : "";
  const at = cursor != null && cursor < n ? cursor : null;

  // The readout hangs 60px left of the cursor, but never past either edge.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip || at == null) return;
    tip.style.left = `${Math.max(0, Math.min(plotW - tip.offsetWidth, xs[at] - 60))}px`;
  });

  const inspect = (i: number) => ready && setCursor(Math.max(0, Math.min(last, i)));
  const pick = (e: ReactPointerEvent) => {
    if (!wrapRef.current) return;
    inspect(Math.round(((e.clientX - wrapRef.current.getBoundingClientRect().left) / plotW) * last));
  };
  const hide = () => setCursor(null);
  const onKey = (e: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const from = at ?? last;
    inspect(e.key === "Home" ? 0 : e.key === "End" ? last : from + (e.key === "ArrowLeft" ? -1 : 1));
  };

  const stamps = points.map((p) => new Date(p.date).getTime());
  const times = ready ? timeAxis(stamps, xs, range, width) : [];

  return (
    <>
      <div className="po-chart-controls" role="group" aria-label="Portfolio history range">
        {GROWTH_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className="po-chart-range"
            aria-pressed={r === range}
            onClick={() => onRange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Sized up front, so nothing below jumps while a range loads. */}
      <div ref={wrapRef} className="po-chart-wrap" style={{ height: CHART_H }}>
        <div ref={tipRef} className="po-chart-tooltip" style={{ opacity: at != null ? 1 : 0 }}>
          {at != null && (
            <>
              <span className="po-tip-date">{growthLabel(points[at], range)}</span>
              <br />
              <span className="money">{fmtCcy(points[at].close, ccy)}</span>
            </>
          )}
        </div>
        {!ready && failed && (
          <div className="po-chart-empty" style={{ height: PLOT_H }}>
            Not enough history for this range
          </div>
        )}
        {width > 0 && (
          <svg
            className="po-chart-svg"
            width={width}
            height={CHART_H}
            tabIndex={0}
            role="img"
            aria-label={
              ready
                ? `${range} portfolio value${spans ? ", with pre-market and after-hours trading" : ""}, ${fmtCcy(values[0], ccy)} to ${fmtCcy(values[last], ccy)}. Use left and right arrow keys to inspect.`
                : `${range} portfolio value`
            }
            onPointerDown={pick}
            onPointerMove={pick}
            onPointerUp={(e) => e.pointerType !== "mouse" && hide()}
            onPointerCancel={hide}
            onPointerLeave={hide}
            onKeyDown={onKey}
            onBlur={hide}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ds-accent)" stopOpacity=".24" />
                <stop offset="100%" stopColor="var(--ds-accent)" stopOpacity=".02" />
              </linearGradient>
            </defs>
            <SessionShade spans={spans} />
            <ValueGrid ticks={scale.ticks} width={width} plotW={plotW} />
            <TimeGrid ticks={times} />
            {ready && (
              <>
                {fill && <path d={fill} fill={`url(#${gradId})`} />}
                <path
                  d={path}
                  fill="none"
                  stroke="var(--ds-accent)"
                  strokeOpacity={spans ? EXTENDED_OPACITY : 1}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {regular && (
                  <path
                    d={regular}
                    fill="none"
                    stroke="var(--ds-accent)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                <circle cx={xs[last]} cy={ys[last]} r={3} fill="var(--ds-accent)" />
                {at != null && (
                  <g>
                    <line x1={xs[at]} x2={xs[at]} y1={0} y2={PLOT_H} stroke="var(--ds-muted)" strokeDasharray="2 3" />
                    <circle
                      cx={xs[at]}
                      cy={ys[at]}
                      r={4}
                      fill="var(--ds-accent)"
                      stroke="var(--ds-bg)"
                      strokeWidth={2}
                    />
                  </g>
                )}
              </>
            )}
          </svg>
        )}
      </div>
    </>
  );
}
