import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { getHistory, getSma } from "../api/market";
import type { HistoryPoint, HistoryRange } from "../api/market";
import { AXIS_H, PLOT_BOTTOM, PLOT_H, PLOT_TOP, plotY, timeAxis, valueAxis } from "../lib/chartAxis";
import { fmtCcy, fmtDay, fmtSignedPct, yahooQuoteUrl } from "../lib/fx";
import TimeGrid from "./TimeGrid";
import ValueGrid from "./ValueGrid";

// Holding Detail's share-price history, drawn the Apple Stocks way (see
// lib/chartAxis): the range picker above, one line stretched from the range's
// low to its high over trading time only, a price scale at the right, a time
// scale beneath, the volume traded under that, the latest close as a dot, a
// scrub readout on demand. The full chart is one tap away at Yahoo (the
// outward arrow), which already supplies our prices.
//
// Under the chart sits one indicator toggle: the 200-day moving average inside
// bands 5, 10 and 15% either side of it. It draws on 3M and longer only (under
// a month of hourly bars the average is a near-flat line that says little).
// The average is always drawn, but of the bands only those the price crosses
// in the range, so the scale stretches no further than it must. The average
// is a dashed ink line; the bands above it
// are teal and those below orange, their zones tinted deeper the farther out,
// and each line is named at its right end. The chip doubles
// as the legend, reading how far the price sits from the average at the
// scrubbed or latest bar; when the price crosses no line, not even the
// average, a note beside it says which lines it stayed between. A scrub reads every drawn line beside
// the crosshair, in the order they cross it, the price slotted in where it sits.

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
// One line's reading in the scrub readout.
type Rung = { color: string; label: string; v: number; kind: "band" | "sma" | "price" };

const VOLUME_GAP = 8;
const VOLUME_H = 18;
const CHART_H = PLOT_H + AXIS_H + VOLUME_GAP + VOLUME_H;

const SMA_WINDOW = 200;
const SMA_RANGES = new Set<HistoryRange>(["3M", "6M", "1Y", "All"]);
// The average and the lines either side of it, top down, each as its distance
// from the average. The zone between two neighbouring lines is tinted in the
// outer one's colour. A band is named by that distance, a percentage, so its
// name reads in mono.
const LEVELS = [
  { f: 0.15, color: "var(--ds-band-above)", tint: 0.13, label: "+15%" },
  { f: 0.1, color: "var(--ds-band-above)", tint: 0.09, label: "+10%" },
  { f: 0.05, color: "var(--ds-band-above)", tint: 0.05, label: "+5%" },
  { f: 0, color: "var(--ds-text)", tint: 0, label: "SMA" },
  { f: -0.05, color: "var(--ds-band-below)", tint: 0.05, label: "−5%" },
  { f: -0.1, color: "var(--ds-band-below)", tint: 0.09, label: "−10%" },
  { f: -0.15, color: "var(--ds-band-below)", tint: 0.13, label: "−15%" },
];
const SMA_DASH = "4 3";
// Each drawn line is named just past its right end, in a column of its own
// between the plot and the price scale, so no name ever covers the price.
// Where lines run closer than a name is tall, the names are spaced apart
// about their lines. JetBrains Mono at --ds-fs-8 (8px × 1.2) advances 0.6em.
const NAME_CHAR_W = 5.76;
const NAME_INSET = 6;
const NAME_GAP = 11;
// The scrub readout's distance from the crosshair, when it lists the bands.
const LADDER_GAP = 10;
// Kept per device, like the appearance setting.
const BANDS_KEY = "portifo.chart.smaBands";

function readPref(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writePref(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // Still applies until the page reloads.
  }
}

// When the price crosses none of the lines, where it stayed instead: between
// the nearest line above its high and the nearest below its low.
function stayedNote(devLo: number, devHi: number) {
  const name = (l: (typeof LEVELS)[number]) => (l.f ? l.label : "the SMA");
  const above = LEVELS.findLast(({ f }) => f > devHi);
  const below = LEVELS.find(({ f }) => f < devLo);
  if (above && below) return `Stayed between ${name(above)} and ${name(below)}`;
  return above ? `Stayed below ${name(above)}` : below ? `Stayed above ${name(below)}` : null;
}

// Heights for labels that want the given ones (top down), at least `gap`
// apart and within min…max: each run that would overlap is spaced out about
// its own centre.
function spread(want: number[], gap: number, min: number, max: number) {
  const place = (n: number, sum: number) => Math.min(Math.max(sum / n - ((n - 1) * gap) / 2, min), max - (n - 1) * gap);
  const groups: { n: number; sum: number; top: number }[] = [];
  for (const y of want) {
    let g = { n: 1, sum: y, top: place(1, y) };
    // Merge back while the run above reaches into this one.
    while (groups.length && groups[groups.length - 1].top + groups[groups.length - 1].n * gap > g.top) {
      const prev = groups.pop()!;
      g = { n: prev.n + g.n, sum: prev.sum + g.sum, top: place(prev.n + g.n, prev.sum + g.sum) };
    }
    groups.push(g);
  }
  return groups.flatMap((g) => Array.from({ length: g.n }, (_, k) => g.top + k * gap));
}

// Runs of consecutive bars that have an average: a bar without a full
// window behind it breaks the lines.
function runs(avg: (number | undefined)[]) {
  const out: number[][] = [];
  avg.forEach((v, i) => {
    if (v == null) return;
    const run = out[out.length - 1];
    if (run && run[run.length - 1] === i - 1) run.push(i);
    else out.push([i]);
  });
  return out;
}

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
// The average by bar time, keyed the same way.
const smaCache = new Map<string, Map<number, number>>();

// `reloadKey` changes on the page's pull to refresh: the range is fetched again.
export default function HoldingChart({ symbol, ccy, reloadKey }: { symbol: string; ccy: string; reloadKey?: number }) {
  const [range, setRange] = useState<HistoryRange>("1M");
  const [pts, setPts] = useState<Pt[] | null>(() => cache.get(`${symbol}|1M`) ?? null);
  const [failed, setFailed] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [bandsOn, setBandsOn] = useState(() => readPref(BANDS_KEY));
  // Tagged with its symbol+range, so a range switch never pairs the new bars
  // with the old range's average.
  const [sma, setSma] = useState<{ key: string; byTime: Map<number, number> } | null>(null);
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
  }, [symbol, range, reloadKey]);

  const smaFits = SMA_RANGES.has(range);
  const bandsShown = bandsOn && smaFits;
  useEffect(() => {
    if (!bandsShown) return;
    const key = `${symbol}|${range}`;
    let live = true;
    const cached = smaCache.get(key);
    if (cached) setSma({ key, byTime: cached });
    getSma(symbol, range, SMA_WINDOW)
      .then((list) => {
        const byTime = new Map(list.map((p) => [new Date(p.date).getTime(), p.value]));
        smaCache.set(key, byTime);
        if (live) setSma({ key, byTime });
      })
      // Without it the chip stays on and the price line draws alone.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [symbol, range, bandsShown, reloadKey]);

  const toggleBands = () => {
    writePref(BANDS_KEY, !bandsOn);
    setBandsOn(!bandsOn);
  };

  const s = pts ?? [];
  const ready = s.length > 1 && width > 0;
  const smaByTime = bandsShown && sma?.key === `${symbol}|${range}` ? sma.byTime : null;
  const avg = smaByTime ? s.map((p) => smaByTime.get(p.t)) : [];
  // The average always, as what the bands are measured from, and the bands
  // the price crosses: those between its farthest below the average and its
  // farthest above. It moves continuously, so it crosses each of them.
  const devs = s.flatMap((p, i) => (avg[i] == null ? [] : [p.p / avg[i] - 1]));
  const devLo = Math.min(...devs);
  const devHi = Math.max(...devs);
  const crosses = ({ f }: { f: number }) => f >= devLo && f <= devHi;
  const levels = devs.length ? LEVELS.filter((l) => !l.f || crosses(l)) : [];
  const stayed = devs.length && !LEVELS.some(crosses) ? stayedNote(devLo, devHi) : null;

  const last = s.length - 1;
  let path = "";
  let lines: { f: number; color: string; d: string }[] = [];
  let zones: { f: number; color: string; tint: number; d: string }[] = [];
  let labels: { label: string; x: number; y: number }[] = [];
  let volume = "";
  let xs: number[] = [];
  let ys: number[] = [];
  let scale = valueAxis(0, 0);
  let plotW = width;
  let lo = 0;
  let hi = 0;
  if (ready) {
    const avgs = avg.filter((v): v is number => v != null);
    const vals = [...s.map((p) => p.p), ...levels.flatMap(({ f }) => avgs.map((v) => v * (1 + f)))];
    lo = Math.min(...vals);
    hi = Math.max(...vals);
    scale = valueAxis(lo, hi);
    const namesW = levels.length ? Math.max(...levels.map((l) => l.label.length)) * NAME_CHAR_W + 2 * NAME_INSET : 0;
    plotW = width - scale.width - namesW;
    xs = s.map((_, i) => (i * plotW) / last);
    ys = s.map((p) => plotY(p.p, lo, hi));
    path = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    // The line f from the average, as points along one run.
    const trace = (run: number[], f: number) =>
      run.map((i) => `${xs[i].toFixed(1)},${plotY((avg[i] as number) * (1 + f), lo, hi).toFixed(1)}`);
    lines = levels.map(({ f, color }) => ({
      f,
      color,
      d: runs(avg)
        .map((run) => `M${trace(run, f).join("L")}`)
        .join(" "),
    }));
    // A zone is tinted only between neighbouring lines that are both drawn:
    // the average can stand apart from the bands the price reached.
    zones = levels.slice(1).flatMap((inner, i) => {
      const upper = levels[i];
      if (LEVELS.indexOf(inner) - LEVELS.indexOf(upper) !== 1) return [];
      // Neighbours never straddle the average, which lies between them.
      const outer = Math.abs(upper.f) > Math.abs(inner.f) ? upper : inner;
      return {
        f: outer.f,
        color: outer.color,
        tint: outer.tint,
        d: runs(avg)
          .map((run) => `M${[...trace(run, upper.f), ...trace(run, inner.f).reverse()].join("L")}Z`)
          .join(" "),
      };
    });
    const end = avg.findLastIndex((v) => v != null);
    if (end >= 0) {
      const at = spread(
        levels.map(({ f }) => plotY((avg[end] as number) * (1 + f), lo, hi)),
        NAME_GAP,
        PLOT_TOP + NAME_GAP / 2,
        PLOT_BOTTOM - NAME_GAP / 2,
      );
      labels = levels.map(({ label }, i) => ({ label, x: plotW + NAME_INSET, y: at[i] }));
    }
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

  // The chip reads the scrubbed bar, else the latest one with an average.
  const smaAt = scrub ?? avg.findLastIndex((v) => v != null);
  const smaValue = smaAt >= 0 ? avg[smaAt] : undefined;
  const gap = smaValue != null ? (s[smaAt].p / smaValue - 1) * 100 : undefined;

  // A scrub reads every drawn line on the crosshair, top down as they cross
  // it, and the price wherever it sits among them.
  const scrubAvg = ready && scrub != null && lines.length ? avg[scrub] : undefined;
  const lineRungs: Rung[] =
    scrubAvg == null
      ? []
      : levels.map(({ f, color, label }) => ({ color, label, v: scrubAvg * (1 + f), kind: f ? "band" : "sma" }));
  const rungs: Rung[] =
    scrubAvg == null || scrub == null
      ? []
      : [...lineRungs, { color: "var(--ds-accent)", label: "Price", v: s[scrub].p, kind: "price" as const }].sort(
          (a, b) => b.v - a.v,
        );

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
        {ready && scrub != null && !rungs.length && (
          <div
            className="hd-chart-tip"
            style={{ left: xs[scrub], transform: `translateX(-${(xs[scrub] / plotW) * 100}%)` }}
          >
            {fmtCcy(s[scrub].p, ccy)} · {ccy} · {tipLabel(s[scrub].t, range)}
          </div>
        )}
        {/* Hangs beside the crosshair, on the side with more room, so the
            crossings themselves stay in view. */}
        {ready && scrub != null && rungs.length > 0 && (
          <div
            className="hd-chart-ladder"
            style={
              xs[scrub] < plotW / 2
                ? { left: xs[scrub] + LADDER_GAP }
                : { left: xs[scrub] - LADDER_GAP, transform: "translateX(-100%)" }
            }
          >
            <span className="hd-chart-ladder-when">{tipLabel(s[scrub].t, range)}</span>
            <span className="hd-chart-ladder-ccy">{ccy}</span>
            {rungs.map((r) => (
              <div key={r.label} className="hd-chart-rung" data-kind={r.kind}>
                <span className="hd-chart-rung-swatch" style={{ color: r.color }} />
                <span className={r.kind === "band" ? "hd-chart-rung-label money" : "hd-chart-rung-label"}>
                  {r.label}
                </span>
                <span className="hd-chart-rung-value money">{fmtCcy(r.v, ccy)}</span>
              </div>
            ))}
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
            aria-label={`${symbol} share price, ${RANGE_WORD[range]}${
              lines.length ? ", with its 200-day average and the bands about it that it crosses" : ""
            }`}
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
                {/* The bands' tints replace the price's fill, rather than mix with it. */}
                {zones.length ? (
                  zones.map((z) => <path key={z.f} d={z.d} fill={z.color} fillOpacity={z.tint} />)
                ) : (
                  <path d={`${path} L${plotW},${PLOT_BOTTOM} L0,${PLOT_BOTTOM} Z`} fill={`url(#${gradId})`} />
                )}
                {lines.map((l) => (
                  <path
                    key={l.f}
                    d={l.d}
                    fill="none"
                    stroke={l.color}
                    strokeWidth={l.f ? 1 : 1.5}
                    strokeDasharray={l.f ? undefined : SMA_DASH}
                    strokeLinejoin="round"
                  />
                ))}
                {labels.map((l) => (
                  <text key={l.label} className="chart-band-label" x={l.x} y={l.y} dy="0.35em">
                    {l.label}
                  </text>
                ))}
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
                    {lineRungs.map((r) => (
                      <circle key={r.label} cx={xs[scrub]} cy={plotY(r.v, lo, hi)} r={2.5} fill={r.color} />
                    ))}
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

      <div className="hd-indicators">
        <button
          type="button"
          className="hd-indicator"
          aria-pressed={bandsOn}
          disabled={!smaFits}
          onClick={toggleBands}
        >
          {/* A band above the average, the average, a band below, as the chart stacks them. */}
          <span className="hd-indicator-bands" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          SMA bands
          {bandsShown && gap != null && <span className="hd-indicator-value">{fmtSignedPct(gap)}</span>}
        </button>
        {!smaFits && <span className="hd-indicator-note">3M and longer</span>}
        {stayed && <span className="hd-indicator-note">{stayed}</span>}
      </div>
    </>
  );
}
