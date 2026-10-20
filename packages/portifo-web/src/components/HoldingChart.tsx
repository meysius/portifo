import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { getHistory, getSma } from "../api/market";
import type { HistoryPoint, HistoryRange } from "../api/market";
import { AXIS_H, PLOT_BOTTOM, PLOT_H, plotY, timeAxis, valueAxis } from "../lib/chartAxis";
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
// Under the chart sit two indicator toggles: the 200-day moving average, and
// that average inside bands 5, 10 and 15% either side of it. Both draw on 3M
// and longer only (under a month of hourly bars the average is a near-flat
// line that says little), and the scale stretches to hold what they draw.
// Each chip doubles as its legend, reading the scrubbed or latest bar: the
// average's price, and how far the price sits above or below it.

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

const SMA_WINDOW = 200;
const SMA_RANGES = new Set<HistoryRange>(["3M", "6M", "1Y", "All"]);
// Each band's distance from the average, inner first. A band is the zone
// between its own line and the next one in, tinted in its line's colour.
const BANDS = [
  { k: 0.05, color: "var(--ds-band-5)" },
  { k: 0.1, color: "var(--ds-band-10)" },
  { k: 0.15, color: "var(--ds-band-15)" },
];
// Kept per device, like the appearance setting.
const SMA_KEY = "portifo.chart.sma200";
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

export default function HoldingChart({ symbol, ccy }: { symbol: string; ccy: string }) {
  const [range, setRange] = useState<HistoryRange>("1M");
  const [pts, setPts] = useState<Pt[] | null>(() => cache.get(`${symbol}|1M`) ?? null);
  const [failed, setFailed] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [smaOn, setSmaOn] = useState(() => readPref(SMA_KEY));
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
  }, [symbol, range]);

  const smaFits = SMA_RANGES.has(range);
  // The bands are drawn around the average, so either toggle draws its line.
  const smaShown = (smaOn || bandsOn) && smaFits;
  const bandsShown = bandsOn && smaFits;
  useEffect(() => {
    if (!smaShown) return;
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
  }, [symbol, range, smaShown]);

  const toggle = (key: string, on: boolean, set: (on: boolean) => void) => {
    writePref(key, !on);
    set(!on);
  };

  const s = pts ?? [];
  const ready = s.length > 1 && width > 0;
  const smaByTime = smaShown && sma?.key === `${symbol}|${range}` ? sma.byTime : null;
  const avg = smaByTime ? s.map((p) => smaByTime.get(p.t)) : [];

  const last = s.length - 1;
  let path = "";
  let smaPath = "";
  let smaYs: (number | null)[] = [];
  let bandPaths: { color: string; lines: string; zone: string }[] = [];
  let volume = "";
  let xs: number[] = [];
  let ys: number[] = [];
  let scale = valueAxis(0, 0);
  let plotW = width;
  if (ready) {
    const avgs = avg.filter((v): v is number => v != null);
    const reach = bandsShown ? BANDS[BANDS.length - 1].k : 0;
    const vals = [...s.map((p) => p.p), ...avgs.map((v) => v * (1 - reach)), ...avgs.map((v) => v * (1 + reach))];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    scale = valueAxis(lo, hi);
    plotW = width - scale.width;
    xs = s.map((_, i) => (i * plotW) / last);
    ys = s.map((p) => plotY(p.p, lo, hi));
    path = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    smaYs = avg.map((v) => (v == null ? null : plotY(v, lo, hi)));
    // The average scaled by f, as points along one run.
    const trace = (run: number[], f: number) =>
      run.map((i) => `${xs[i].toFixed(1)},${plotY((avg[i] as number) * f, lo, hi).toFixed(1)}`);
    const line = (f: number) => runs(avg).map((run) => `M${trace(run, f).join("L")}`);
    const zone = (inner: number, outer: number) =>
      runs(avg).map((run) => `M${[...trace(run, outer), ...trace(run, inner).reverse()].join("L")}Z`);
    smaPath = line(1).join(" ");
    if (bandsShown) {
      bandPaths = BANDS.map(({ k, color }, b) => {
        const inner = b ? BANDS[b - 1].k : 0;
        return {
          color,
          lines: [...line(1 + k), ...line(1 - k)].join(" "),
          zone: [...zone(1 + inner, 1 + k), ...zone(1 - inner, 1 - k)].join(" "),
        };
      });
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

  // The legends read the scrubbed bar, else the latest one with an average.
  const smaAt = scrub ?? avg.findLastIndex((v) => v != null);
  const smaValue = smaAt >= 0 ? avg[smaAt] : undefined;
  const gap = smaValue != null ? (s[smaAt].p / smaValue - 1) * 100 : undefined;

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
            aria-label={`${symbol} share price, ${RANGE_WORD[range]}${
              bandPaths.length ? ", with its 200-day average and bands" : smaPath ? ", with its 200-day average" : ""
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
                {bandPaths.length ? (
                  bandPaths.map((b) => (
                    <g key={b.color}>
                      <path d={b.zone} fill={b.color} fillOpacity={0.08} />
                      <path d={b.lines} fill="none" stroke={b.color} strokeWidth={1} strokeLinejoin="round" />
                    </g>
                  ))
                ) : (
                  <path d={`${path} L${plotW},${PLOT_BOTTOM} L0,${PLOT_BOTTOM} Z`} fill={`url(#${gradId})`} />
                )}
                {smaPath && (
                  <path
                    d={smaPath}
                    fill="none"
                    stroke="var(--ds-indicator)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
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
                    {smaYs[scrub] != null && (
                      <circle cx={xs[scrub]} cy={smaYs[scrub]} r={2.5} fill="var(--ds-indicator)" />
                    )}
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
          aria-pressed={smaOn}
          disabled={!smaFits}
          onClick={() => toggle(SMA_KEY, smaOn, setSmaOn)}
        >
          <span className="hd-indicator-swatch" aria-hidden="true" />
          200-day SMA
          {smaOn && smaShown && smaValue != null && (
            <span className="hd-indicator-value">{fmtCcy(smaValue, ccy)}</span>
          )}
        </button>
        <button
          type="button"
          className="hd-indicator"
          aria-pressed={bandsOn}
          disabled={!smaFits}
          onClick={() => toggle(BANDS_KEY, bandsOn, setBandsOn)}
        >
          {/* The upper half of the bands, outermost on top, as the chart stacks them. */}
          <span className="hd-indicator-bands" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          SMA bands
          {bandsShown && gap != null && <span className="hd-indicator-value">{fmtSignedPct(gap)}</span>}
        </button>
        {!smaFits && <span className="hd-indicator-note">3M and longer</span>}
      </div>
    </>
  );
}
