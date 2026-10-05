import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { getHistory } from "../api/market";
import type { HistoryPoint, HistoryRange } from "../api/market";
import { fmtCcy, fmtDay, yahooQuoteUrl } from "../lib/fx";

// Holding Detail's share-price history. Deliberately quiet: the position's
// value and today's return above it are the story, and this only gives them
// context — one line, no markers, no reference lines, a scrub readout on
// demand. The full chart is one tap away at Yahoo (the outward arrow), which
// already supplies our prices.

const RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "1Y", "All"];
const RANGE_WORD: Partial<Record<HistoryRange, string>> = {
  "1D": "today",
  "1W": "past week",
  "1M": "past month",
  "3M": "past 3 months",
  "1Y": "past year",
  All: "all time",
};

// The study's geometry: a 94px plot whose line spans y 15–82, with two dashed
// guides at 28 and 61.
const H = 94;
const TOP = 15;
const BOTTOM = 82;

type Pt = { t: number; p: number };

const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function axisLabel(t: number, range: HistoryRange) {
  const d = new Date(t);
  if (range === "1D") return fmtTime(t);
  if (range === "All") return String(d.getFullYear());
  if (range === "1Y") return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
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
        const next = h.map((p) => ({ t: new Date(p.date).getTime(), p: p.close })).filter((p) => p.p > 0);
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

  let path = "";
  let xs: number[] = [];
  let ys: number[] = [];
  if (ready) {
    const t0 = s[0].t;
    const span = s[s.length - 1].t - t0 || 1;
    const lo = Math.min(...s.map((p) => p.p));
    const hi = Math.max(...s.map((p) => p.p));
    xs = s.map((p) => ((p.t - t0) / span) * width);
    ys = s.map((p) => (hi > lo ? BOTTOM - ((p.p - lo) / (hi - lo)) * (BOTTOM - TOP) : (TOP + BOTTOM) / 2));
    path = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  }

  const pick = (e: ReactPointerEvent) => {
    if (!ready || !wrapRef.current) return;
    const px = Math.max(0, Math.min(width, e.clientX - wrapRef.current.getBoundingClientRect().left));
    let i = 0;
    while (i < xs.length - 1 && xs[i + 1] <= px) i++;
    if (i < xs.length - 1 && px - xs[i] > xs[i + 1] - px) i++;
    setScrub(i);
  };
  const release = () => setScrub(null);
  const last = s.length - 1;

  return (
    <>
      <div ref={wrapRef} className="hd-chart">
        {/* Slides with the cursor but never leaves the plot: at the left edge it
            hangs right of the cursor, at the right edge left of it. */}
        {ready && scrub != null && (
          <div
            className="hd-chart-tip"
            style={{ left: xs[scrub], transform: `translateX(-${(xs[scrub] / width) * 100}%)` }}
          >
            {fmtCcy(s[scrub].p, ccy)} · {ccy} · {range === "1D" ? fmtTime(s[scrub].t) : fmtDay(new Date(s[scrub].t))}
          </div>
        )}
        {!ready && failed && <div className="hd-chart-empty">Price history unavailable</div>}
        {width > 0 && (
          <svg
            width={width}
            height={H}
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
                <stop offset="0%" stopColor="var(--ds-accent)" stopOpacity=".1" />
                <stop offset="100%" stopColor="var(--ds-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M0 28H${width}M0 61H${width}`}
              fill="none"
              stroke="var(--ds-line)"
              strokeWidth={0.7}
              strokeDasharray="2 4"
            />
            {ready && (
              <>
                <path d={`${path} L${width},${H} L0,${H} Z`} fill={`url(#${gradId})`} />
                <path
                  d={path}
                  fill="none"
                  stroke="var(--ds-accent)"
                  strokeWidth={1.7}
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
                      y2={H}
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

      {/* Holds its line while loading, so the range strip never jumps. */}
      <div className="hd-chart-axis">
        <span>{ready ? axisLabel(s[0].t, range) : "\u00a0"}</span>
        <span>{ready ? axisLabel(s[last].t, range) : ""}</span>
      </div>

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
    </>
  );
}
