import { useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { HistoryPoint, HistoryRange } from "../api/market";
import { fmtCcy } from "../lib/fx";

// Portfolio's value over time, from design-poc/portfolio-overview.html: a
// cobalt line over a faint wash, three dashed guides, the latest value as a
// dot, and a readout on demand (drag, hover, or arrow keys). Points are spaced
// by index, not by time, so nights and weekends take no width.

const GROWTH_RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "1Y", "All"];

// The study draws into a 342 × 125 viewBox stretched over a 100px plot. These
// are its y coordinates, scaled to pixels.
const H = 100;
const SY = H / 125;
const GUIDES = [28, 70, 112].map((y) => y * SY);
const BOTTOM = 112 * SY;
const SPAN = 93 * SY;
const FLAT = 65 * SY;

function growthLabel(iso: string, range: HistoryRange) {
  return new Date(iso).toLocaleString(
    "en-US",
    range === "1D"
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", year: range === "1Y" || range === "All" ? "numeric" : undefined },
  );
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
  const xs = points.map((_, i) => (ready ? (i * width) / last : 0));
  const ys = values.map((v) => (max === min ? FLAT : BOTTOM - ((v - min) / (max - min)) * SPAN));
  const path = ready ? xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ") : "";
  const at = cursor != null && cursor < n ? cursor : null;

  // The readout hangs 60px left of the cursor, but never past either edge.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip || at == null) return;
    tip.style.left = `${Math.max(0, Math.min(width - tip.offsetWidth, xs[at] - 60))}px`;
  });

  const inspect = (i: number) => ready && setCursor(Math.max(0, Math.min(last, i)));
  const pick = (e: ReactPointerEvent) => {
    if (!wrapRef.current) return;
    inspect(Math.round(((e.clientX - wrapRef.current.getBoundingClientRect().left) / width) * last));
  };
  const hide = () => setCursor(null);
  const onKey = (e: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const from = at ?? last;
    inspect(e.key === "Home" ? 0 : e.key === "End" ? last : from + (e.key === "ArrowLeft" ? -1 : 1));
  };

  const axis = ready ? [0, Math.round(last / 2), last] : [];

  return (
    <>
      <div ref={wrapRef} className="po-chart-wrap">
        <div ref={tipRef} className="po-chart-tooltip" style={{ opacity: at != null ? 1 : 0 }}>
          {at != null && (
            <>
              <span className="po-tip-date">{growthLabel(points[at].date, range)}</span>
              <br />
              <span className="money">{fmtCcy(points[at].close, ccy)}</span>
            </>
          )}
        </div>
        {!ready && failed && <div className="po-chart-empty">Not enough history for this range</div>}
        {width > 0 && (
          <svg
            className="po-chart-svg"
            width={width}
            height={H}
            tabIndex={0}
            role="img"
            aria-label={
              ready
                ? `${range} portfolio value, ${fmtCcy(values[0], ccy)} to ${fmtCcy(values[last], ccy)}. Use left and right arrow keys to inspect.`
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
                <stop offset="0%" stopColor="var(--ds-accent)" stopOpacity=".12" />
                <stop offset="100%" stopColor="var(--ds-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={GUIDES.map((y) => `M0 ${y}H${width}`).join("")}
              fill="none"
              stroke="var(--ds-line)"
              strokeWidth={0.56}
              strokeDasharray="2 4"
            />
            {ready && (
              <>
                <path d={`${path} L${width},${H} L0,${H} Z`} fill={`url(#${gradId})`} />
                <path
                  d={path}
                  fill="none"
                  stroke="var(--ds-accent)"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={xs[last]} cy={ys[last]} r={3} fill="var(--ds-accent)" />
                {at != null && (
                  <g>
                    <line x1={xs[at]} x2={xs[at]} y1={0} y2={H} stroke="var(--ds-muted)" strokeDasharray="2 3" />
                    <circle cx={xs[at]} cy={ys[at]} r={4} fill="var(--ds-accent)" stroke="var(--ds-bg)" strokeWidth={2} />
                  </g>
                )}
              </>
            )}
          </svg>
        )}
      </div>

      {/* Holds its line while loading, so the range strip never jumps. */}
      <div className="po-chart-axis">
        {ready ? axis.map((i) => <span key={i}>{growthLabel(points[i].date, range)}</span>) : <span>{" "}</span>}
      </div>

      <div className="po-chart-controls" role="group" aria-label="Portfolio history range">
        {GROWTH_RANGES.map((r) => (
          <button key={r} type="button" className="po-chart-range" aria-pressed={r === range} onClick={() => onRange(r)}>
            {r}
          </button>
        ))}
      </div>
    </>
  );
}
