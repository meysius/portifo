import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { getHistory } from "../api/market";
import type { HistoryPoint, HistoryRange } from "../api/market";
import { AXIS_H, PLOT_BOTTOM, PLOT_H, plotY, timeAxis, valueAxis } from "../lib/chartAxis";
import { fmtCcy, fmtDay, yahooQuoteUrl } from "../lib/fx";
import TimeGrid from "./TimeGrid";
import ValueGrid from "./ValueGrid";

// Holding Detail's share-price history, drawn the Apple Stocks way (see
// lib/chartAxis): the range picker above, one line stretched from the range's
// low to its high over trading time only, a price scale at the right, a time
// scale beneath, the volume traded under that, the latest close as a dot, a
// scrub readout on demand. The full chart is one tap away at Yahoo (the
// outward arrow), which already supplies our prices.

const RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "All"];
const RANGE_WORD: Partial<Record<HistoryRange, string>> = {
  "1D": "today",
  "1W": "past week",
  "1M": "past month",
  "3M": "past 3 months",
  "6M": "past 6 months",
  "1Y": "past year",
  All: "all time",
};

// Price and shares traded per bar.
type Pt = { t: number; p: number; v: number };

const VOLUME_GAP = 8;
const VOLUME_H = 18;
const CHART_H = PLOT_H + AXIS_H + VOLUME_GAP + VOLUME_H;

const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function tipLabel(t: number, range: HistoryRange) {
  if (range === "1D") return fmtTime(t);
  if (range === "1W" || range === "1M") return `${fmtDay(new Date(t))}, ${fmtTime(t)}`;
  return fmtDay(new Date(t));
}

// Grey strokes rising from the strip's floor, scaled to the range's busiest
// bar, as Apple shows them. Bars nearer than 3px are summed, so a decade of
// weeks reads as a texture rather than a solid block.
function volumePath(xs: number[], s: Pt[]) {
  const bars: { x: number; v: number }[] = [];
  xs.forEach((x, i) => {
    const bar = bars[bars.length - 1];
    if (bar && x - bar.x < 3) bar.v += s[i].v;
    else bars.push({ x, v: s[i].v });
  });
  const max = Math.max(...bars.map((b) => b.v));
  if (!(max > 0)) return "";
  return bars
    .filter((b) => b.v > 0)
    .map((b) => `M${b.x.toFixed(1)} ${CHART_H}v-${Math.max(1, (b.v / max) * VOLUME_H).toFixed(1)}`)
    .join("");
}

// Last-fetched series per symbol+range, so flipping back to a range (or pushing
// the same holding again) redraws at once.
const cache = new Map<string, Pt[]>();

export default function HoldingChart({ symbol, ccy }: { symbol: string; ccy: string }) {
  const [range, setRange] = useState<HistoryRange>("1M");
  const [pts, setPts] = useState<Pt[] | null>(() => cache.get(`${symbol}|1M`) ?? null);
  const [failed, setFailed] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gradId = useId();

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const key = `${symbol}|${range}`;
    let live = true;
    setScrub(null);
    setFailed(false);
    setPts(cache.get(key) ?? null);
    getHistory(symbol, range)
      .then((h: HistoryPoint[]) => {
        const next = h
          .map((p) => ({ t: new Date(p.date).getTime(), p: p.close, v: p.volume ?? 0 }))
          .filter((p) => p.p > 0);
        cache.set(key, next);
        if (live) setPts(next);
      })
      .catch(() => {
        if (live && !cache.has(key)) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [symbol, range]);

  const s = pts ?? [];
  const ready = s.length > 1 && width > 0;

  const last = s.length - 1;
  let path = "";
  let volume = "";
  let xs: number[] = [];
  let ys: number[] = [];
  let scale = valueAxis(0, 0);
  let plotW = width;
  if (ready) {
    const lo = Math.min(...s.map((p) => p.p));
    const hi = Math.max(...s.map((p) => p.p));
    scale = valueAxis(lo, hi);
    plotW = width - scale.width;
    xs = s.map((_, i) => (i * plotW) / last);
    ys = s.map((p) => plotY(p.p, lo, hi));
    path = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    volume = volumePath(xs, s);
  }
  const stamps = s.map((p) => p.t);
  const times = ready ? timeAxis(stamps, xs, range, width) : [];

  const pick = (e: ReactPointerEvent) => {
    if (!ready || !wrapRef.current) return;
    const px = e.clientX - wrapRef.current.getBoundingClientRect().left;
    setScrub(Math.max(0, Math.min(last, Math.round((px / plotW) * last))));
  };
  const release = () => setScrub(null);

  return (
    <>
      <div className="hd-chart-controls" role="group" aria-label="Price history range">
        {RANGES.map((r) => (
          <button key={r} type="button" className="hd-range" aria-pressed={r === range} onClick={() => setRange(r)}>
            {r}
          </button>
        ))}
        {/* Leaves the app, so an outward arrow — never a chevron. */}
        <a
          className="hd-chart-ext"
          href={yahooQuoteUrl(symbol)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${symbol} chart on Yahoo Finance`}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 15 15 5M5 5h10v10" />
          </svg>
        </a>
      </div>

      {/* Sized up front, so nothing below jumps while a range loads. */}
      <div ref={wrapRef} className="hd-chart" style={{ height: CHART_H }}>
        {/* Slides with the cursor but never leaves the plot: at the left edge it
            hangs right of the cursor, at the right edge left of it. */}
        {ready && scrub != null && (
          <div
            className="hd-chart-tip"
            style={{ left: xs[scrub], transform: `translateX(-${(xs[scrub] / plotW) * 100}%)` }}
          >
            {fmtCcy(s[scrub].p, ccy)} · {ccy} · {tipLabel(s[scrub].t, range)}
          </div>
        )}
        {!ready && failed && (
          <div className="hd-chart-empty" style={{ height: PLOT_H }}>
            Price history unavailable
          </div>
        )}
        {width > 0 && (
          <svg
            width={width}
            height={CHART_H}
            role="img"
            aria-label={`${symbol} share price, ${RANGE_WORD[range]}`}
            onPointerDown={pick}
            onPointerMove={pick}
            onPointerUp={(e) => e.pointerType !== "mouse" && release()}
            onPointerCancel={release}
            onPointerLeave={release}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ds-accent)" stopOpacity=".24" />
                <stop offset="100%" stopColor="var(--ds-accent)" stopOpacity=".02" />
              </linearGradient>
            </defs>
            <ValueGrid ticks={scale.ticks} width={width} plotW={plotW} />
            <TimeGrid ticks={times} />
            {volume && <path d={volume} fill="none" stroke="var(--ds-muted)" strokeWidth={1.5} />}
            {ready && (
              <>
                <path d={`${path} L${plotW},${PLOT_BOTTOM} L0,${PLOT_BOTTOM} Z`} fill={`url(#${gradId})`} />
                <path
                  d={path}
                  fill="none"
                  stroke="var(--ds-accent)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={xs[last]} cy={ys[last]} r={3} fill="var(--ds-accent)" />
                {scrub != null && (
                  <g>
                    <line
                      x1={xs[scrub]}
                      x2={xs[scrub]}
                      y1={0}
                      y2={PLOT_H}
                      stroke="var(--ds-muted)"
                      strokeDasharray="2 3"
                    />
                    <circle
                      cx={xs[scrub]}
                      cy={ys[scrub]}
                      r={3.5}
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
