import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { EXTENDED_LABEL, getEarnings, getHistory, getSma } from "../api/market";
import type { HistoryPoint, HistoryRange, Quote } from "../api/market";
import {
  AXIS_H,
  EXTENDED_OPACITY,
  PLOT_BOTTOM,
  PLOT_H,
  PLOT_TOP,
  linePath,
  liveLabel,
  plotY,
  sessionSpans,
  spansDates,
  timeAxis,
  valueAxis,
  valueColumnWidth,
} from "../lib/chartAxis";
import type { Session, SessionSpans } from "../lib/chartAxis";
import { EARNINGS_KEY, SMA_BANDS_KEY, useChartPref } from "../lib/chartPrefs";
import { DAY_BAR_MS, barStart, latestTrade, withLatest } from "../lib/liveSeries";
import { fmtCcy, fmtDay, fmtSignedPct, yahooQuoteUrl } from "../lib/fx";
import SessionShade from "./SessionShade";
import TimeGrid from "./TimeGrid";
import ValueGrid from "./ValueGrid";

// Holding Detail's share-price history, drawn the Apple Stocks way (see
// lib/chartAxis): the range picker above, one line stretched from the range's
// low to its high over trading time only, a price scale at the right, a time
// scale beneath, the volume traded under that, the latest price as a dot, a
// scrub readout on demand. The full chart is one tap away at Yahoo (the
// outward arrow), which already supplies our prices.
//
// Under the chart sits one indicator toggle: the 200-day moving average inside
// bands 5, 10 and 15% either side of it, on every range. Within a session the
// average holds still, so on 1D it is a level line and on 1W it steps once a
// session. Only the lines the price crosses set the scale, so the price keeps
// its own: of the bands, only those are drawn. The average is always drawn,
// but when the price stays to one side of it, it never stretches the scale.
// Where it runs outside, it is cut off at the plot's edge, and when it ends
// outside, its name points to it there ("SMA ↓"). Without that, a price 18%
// above its average flattens a day's move into a line along the top. The
// average is a dashed ink line; the bands above it are teal and those below
// orange. Every zone the price passes through is tinted, deeper the farther
// out, and each line is named at its right end. The chip doubles
// as the legend, reading how far the price sits from the average at the
// scrubbed or latest bar; when the price crosses no line, not even the
// average, a note beside it says which lines it stayed between. A scrub reads every drawn line beside
// the crosshair, in the order they cross it, the price slotted in where it sits.
//
// A second toggle, Earnings, draws a vertical line at each report in the
// range, so the trend before a report can be read against the trend after.
// It draws on 1W to 5Y only.
//
// 1D runs across the day's pre-market and after-hours trading, always (it was
// a toggle until Nov 6). Those stretches sit on a recessed ground with the
// line faded through them, so the regular session still reads as the day;
// a scrub names the session it lands in. The price above the chart stays the
// regular session's. 1D is the last trading day, not the last 24 hours, and
// it turns over at the open: before it, the day before, then today's
// pre-market after it, the new day named where it begins. A market that
// never closes (crypto, currencies, futures) shows its last 24 hours.
//
// On 1D the line runs on to the latest trade as the quote streams in, and the
// price tagged on the scale moves with it (see lib/liveSeries): every trade,
// those outside the regular session too, overnight included.

const RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y", "5Y", "All"];
const RANGE_WORD: Partial<Record<HistoryRange, string>> = {
  "1D": "today",
  "1W": "past week",
  "1M": "past month",
  "3M": "past 3 months",
  "6M": "past 6 months",
  "1Y": "past year",
  "2Y": "past 2 years",
  "5Y": "past 5 years",
  All: "all time",
};

// Price and shares traded per bar, and its session when it isn't the regular one.
type Pt = { t: number; p: number; v: number; x?: Session };

// One line's reading in the scrub readout.
type Rung = { color: string; label: string; v: number; kind: "band" | "sma" | "price" };

const VOLUME_GAP = 8;
const VOLUME_H = 18;
const CHART_H = PLOT_H + AXIS_H + VOLUME_GAP + VOLUME_H;

const SMA_WINDOW = 200;
// The average and the lines either side of it, top down, each as its distance
// from the average. The zone between two neighbouring lines is tinted in the
// outer one's colour, when the price passes through it. A band is named by
// that distance, a percentage, so its name reads in mono.
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

// Not on 1D: companies report outside trading hours, so a report never falls
// inside the session the chart shows. Not on All: ten years of quarters is 40
// lines 8px apart, a barcode the price can't be read through.
const EARNINGS_RANGES = new Set<HistoryRange>(["1W", "1M", "3M", "6M", "1Y", "2Y", "5Y"]);
// The ranges the API draws in weekly bars (Monday to Friday, stamped at
// Monday's midnight where the symbol trades).
const WEEKLY_RANGES = new Set<HistoryRange>(["2Y", "5Y", "All"]);
// From a weekly bar's stamp to its Friday close: 4 days and 16 hours.
const WEEK_CLOSE_MS = (4 * 24 + 16) * 3_600_000;

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

// Where each report's line goes: just before the first bar whose close comes
// after it, the first that could react to it, so the line parts the closes
// struck before the news from those struck after. Companies report before the
// open or after the close, so for daily or hourly bars that is the first bar
// that starts after the report, and the line falls in the overnight gap. A
// weekly bar closes on Friday, so it reacts to a report made during its week,
// though not to one after Friday's close (Berkshire reports on Saturdays). A
// report with no bar on one side of it in the range gets no line. Returns each
// line's bar index, once.
function reportBars(stamps: number[], reports: number[], weekly: boolean) {
  const at = new Set<number>();
  for (const r of reports) {
    let i = stamps.findIndex((t) => t > r);
    if (weekly) {
      i = (i < 0 ? stamps.length : i) - 1;
      if (i >= 0 && r >= stamps[i] + WEEK_CLOSE_MS) i++;
    }
    if (i > 0 && i < stamps.length) at.add(i);
  }
  return [...at];
}

// The average for each bar: the newest one stamped at or before it. Our bars
// and the average's come from two requests, and match by time, except the
// live bar Yahoo appends while the market is open. That one is stamped with the
// latest trade, so its time differs between the two, and it takes the average
// stamped just before it, which already counts today's price. Bars before the
// first full window have none.
function averageAt(stamps: number[], points: [number, number][]) {
  let j = -1;
  return stamps.map((t) => {
    while (j + 1 < points.length && points[j + 1][0] <= t) j++;
    return j >= 0 ? points[j][1] : undefined;
  });
}

// A request tried again, 2s and then 6s on, while its answer is still
// wanted: one refused by Yahoo would otherwise leave a toggle on and drawing
// nothing until the range changes.
const RETRY_MS = [2_000, 6_000];
async function retrying<T>(load: () => Promise<T>, wanted: () => boolean): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await load();
    } catch (err) {
      if (i >= RETRY_MS.length || !wanted()) throw err;
      await new Promise((r) => setTimeout(r, RETRY_MS[i]));
      if (!wanted()) throw err;
    }
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

// `dated`: a 1D that runs over two dates, whose times need their day.
function tipLabel(t: number, range: HistoryRange, session?: Session, dated = false) {
  if (range === "1D") {
    const time = dated ? `${new Date(t).toLocaleDateString("en-US", { weekday: "short" })} ${fmtTime(t)}` : fmtTime(t);
    return session ? `${time} · ${EXTENDED_LABEL[session]}` : time;
  }
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

// Last-fetched series per symbol+range, so flipping back
// to a range (or pushing the same holding again) redraws at once.
const cache = new Map<string, Pt[]>();
// The average by bar time, keyed the same way.
const smaCache = new Map<string, [number, number][]>();
// Report times per symbol, for every range.
const earningsCache = new Map<string, number[]>();

// `quote` is the symbol's live one; 1D follows it. `reloadKey` changes on the
// page's pull to refresh: the range is fetched again.
export default function HoldingChart({ symbol, quote, reloadKey }: { symbol: string; quote: Quote; reloadKey?: number }) {
  const ccy = quote.currency;
  // Every chart opens on today.
  const [range, setRange] = useState<HistoryRange>("1D");
  const [scrubbed, setScrub] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [bandsOn, setBandsOn] = useChartPref(SMA_BANDS_KEY);
  const [earningsOn, setEarningsOn] = useChartPref(EARNINGS_KEY);
  // 1D always runs across extended hours.
  const extended = range === "1D";
  const key = `${symbol}|${range}`;
  // What was fetched, each tagged with its series' key (the report times with
  // their symbol), so a range switch never pairs the new bars with the old
  // range's. Until a fetch lands, the last one kept for that key is drawn,
  // read as the chart renders: read later, a switch back to a range drew a
  // frame without its bands, the price's fill flashing in their place.
  const [fetched, setFetched] = useState<{ key: string; pts: Pt[] } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [sma, setSma] = useState<{ key: string; points: [number, number][] } | null>(null);
  const [smaFailedKey, setSmaFailedKey] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<{ symbol: string; times: number[] } | null>(null);
  const pts = fetched?.key === key ? fetched.pts : (cache.get(key) ?? null);
  const failed = failedKey === key && !pts;
  const wrapRef = useRef<HTMLDivElement>(null);
  const gradId = useId();
  const clipId = useId();

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Counts 1D's refetches on the clock, which keep the scrub and what's drawn.
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setScrub(null);
  }, [key, reloadKey]);

  useEffect(() => {
    let live = true;
    retrying(() => getHistory(symbol, range, extended), () => live)
      .then((h: HistoryPoint[]) => {
        const next = h
          .map((p) => ({ t: new Date(p.date).getTime(), p: p.close, v: p.volume ?? 0, x: p.session }))
          .filter((p) => p.p > 0);
        cache.set(key, next);
        if (live) setFetched({ key, pts: next });
      })
      .catch(() => {
        if (live) setFailedKey(key);
      });
    return () => {
      live = false;
    };
  }, [symbol, range, extended, key, reloadKey, refresh]);

  // On 1D, the latest trade the quote has streamed in. Once it runs past the
  // fetched bars, they're fetched again five minutes on, and every five
  // minutes while it stays ahead; not overnight, which Yahoo doesn't chart.
  const latest = range === "1D" ? latestTrade(quote, extended) : null;
  const trade: Pt | null = latest && { ...latest, v: 0 };
  const fetchedEnd = pts?.length ? pts[pts.length - 1].t : null;
  const behind =
    trade != null && trade.x !== "overnight" && fetchedEnd != null && trade.t - barStart(fetchedEnd) > DAY_BAR_MS;
  useEffect(() => {
    if (!behind) return;
    const id = setTimeout(() => setRefresh((n) => n + 1), DAY_BAR_MS);
    return () => clearTimeout(id);
  }, [behind, key, refresh]);

  // Fetched again with 1D's bars, too: today's average counts the latest price.
  useEffect(() => {
    if (!bandsOn) return;
    let live = true;
    retrying(() => getSma(symbol, range, SMA_WINDOW, extended), () => live)
      .then((list) => {
        // Oldest first, as averageAt walks them.
        const points = list
          .map((p): [number, number] => [new Date(p.date).getTime(), p.value])
          .sort((a, b) => a[0] - b[0]);
        smaCache.set(key, points);
        if (live) setSma({ key, points });
      })
      // The chip says so, and the price line draws alone.
      .catch(() => {
        if (live) setSmaFailedKey(key);
      });
    return () => {
      live = false;
    };
  }, [symbol, range, extended, key, bandsOn, reloadKey, refresh]);

  const earningsFits = EARNINGS_RANGES.has(range);
  const earningsShown = earningsOn && earningsFits;
  useEffect(() => {
    if (!earningsShown) return;
    let live = true;
    retrying(() => getEarnings(symbol), () => live)
      .then((list) => {
        const times = list.map((r) => new Date(r.date).getTime());
        earningsCache.set(symbol, times);
        if (live) setEarnings({ symbol, times });
      })
      // Without them the chip stays on and the chart draws no lines.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [symbol, earningsShown, reloadKey]);

  const s = withLatest(pts ?? [], trade);
  const ready = s.length > 1 && width > 0;
  const smaPoints = bandsOn ? (sma?.key === key ? sma.points : (smaCache.get(key) ?? null)) : null;
  const smaFailed = bandsOn && !smaPoints && smaFailedKey === key;
  const avg = smaPoints ? averageAt(s.map((p) => p.t), smaPoints) : [];
  // The average always, as what the bands are measured from, and the bands
  // the price crosses: those between its farthest below the average and its
  // farthest above. It moves continuously, so it crosses each of them. Only
  // the crossed lines set the scale, the average included.
  const devs = s.flatMap((p, i) => (avg[i] == null ? [] : [p.p / avg[i] - 1]));
  const devLo = Math.min(...devs);
  const devHi = Math.max(...devs);
  const crosses = ({ f }: { f: number }) => f >= devLo && f <= devHi;
  const levels = devs.length ? LEVELS.filter((l) => !l.f || crosses(l)) : [];
  const stayed = devs.length && !LEVELS.some(crosses) ? stayedNote(devLo, devHi) : null;
  const reports = earningsShown
    ? earnings?.symbol === symbol
      ? earnings.times
      : (earningsCache.get(symbol) ?? null)
    : null;
  const stamps = s.map((p) => p.t);
  const dated = range === "1D" && spansDates(stamps);

  const last = s.length - 1;
  // A refetch can bring fewer bars than were scrubbed across (a new day's).
  const scrub = scrubbed != null && scrubbed <= last ? scrubbed : null;
  let path = "";
  // With extended hours: where the regular session runs, the line through it
  // alone, and the ground under it.
  let spans: SessionSpans | null = null;
  let regular = "";
  let fill = "";
  let lines: { f: number; color: string; d: string }[] = [];
  let zones: { f: number; color: string; tint: number; d: string }[] = [];
  let labels: { label: string; x: number; y: number }[] = [];
  let reportXs: number[] = [];
  let volume = "";
  let xs: number[] = [];
  let ys: number[] = [];
  let scale = valueAxis(0, 0);
  // On 1D, the latest price, tagged on the scale.
  const live = range === "1D" && s.length > 1 ? liveLabel(s[s.length - 1].p) : null;
  let plotW = width;
  let lo = 0;
  let hi = 0;
  if (ready) {
    const avgs = avg.filter((v): v is number => v != null);
    const vals = [...s.map((p) => p.p), ...levels.filter(crosses).flatMap(({ f }) => avgs.map((v) => v * (1 + f)))];
    lo = Math.min(...vals);
    hi = Math.max(...vals);
    scale = valueAxis(lo, hi);
    const end = avg.findLastIndex((v) => v != null);
    // An average that ends outside the scale is named at that edge, pointing
    // the way it lies.
    const smaEnd = end >= 0 ? (avg[end] as number) : NaN;
    const smaName = smaEnd < lo ? "SMA ↓" : smaEnd > hi ? "SMA ↑" : "SMA";
    const name = (l: (typeof LEVELS)[number]) => (l.f ? l.label : smaName);
    const namesW = levels.length ? Math.max(...levels.map((l) => name(l).length)) * NAME_CHAR_W + 2 * NAME_INSET : 0;
    plotW = width - valueColumnWidth(scale.width, live) - namesW;
    xs = s.map((_, i) => (i * plotW) / last);
    ys = s.map((p) => plotY(p.p, lo, hi));
    path = linePath(xs, ys);
    spans = sessionSpans(
      s.map((p) => p.x),
      xs,
      plotW,
    );
    // The fill lies under the regular session only.
    if (!spans) fill = `${path} L${plotW},${PLOT_BOTTOM} L0,${PLOT_BOTTOM} Z`;
    else if (spans.open >= 0) {
      regular = linePath(xs, ys, spans.open, spans.close);
      fill = `${regular} L${xs[spans.close].toFixed(1)},${PLOT_BOTTOM} L${xs[spans.open].toFixed(1)},${PLOT_BOTTOM} Z`;
    }
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
    // Every zone the price passes through is tinted, between its own two
    // lines, whether or not they're drawn: a price that crosses only +15%
    // still shows the 10–15% zone under it, and one that crosses nothing
    // sits on its zone's tint. Past the scale, a zone is cut off at the
    // plot's edge. Beyond ±15% is no zone. (Tinting only between two drawn
    // neighbours left most short ranges with no tint at all.)
    zones = LEVELS.slice(1).flatMap((inner, i) => {
      const upper = LEVELS[i];
      if (!(devHi > inner.f && devLo < upper.f)) return [];
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
    if (end >= 0) {
      // An off-scale name is held at the edge it lies past, and wants no more
      // than that, so it can't drag a neighbour's name away from its line.
      const at = spread(
        levels.map(({ f }) => Math.min(Math.max(plotY(smaEnd * (1 + f), lo, hi), PLOT_TOP), PLOT_BOTTOM)),
        NAME_GAP,
        PLOT_TOP + NAME_GAP / 2,
        PLOT_BOTTOM - NAME_GAP / 2,
      );
      labels = levels.map((l, i) => ({ label: name(l), x: plotW + NAME_INSET, y: at[i] }));
    }
    if (reports) {
      // Midway between the two bars, on a whole pixel so the hairline stays crisp.
      reportXs = reportBars(stamps, reports, WEEKLY_RANGES.has(range)).map((i) => Math.round((xs[i - 1] + xs[i]) / 2) + 0.5);
    }
    volume = volumePath(xs, s);
  }
  const times = ready ? timeAxis(stamps, xs, range, width) : [];
  // Beside the Earnings chip: why it can't draw on this range, or why, on, it draws nothing.
  const earningsNote = !earningsFits
    ? "1W to 5Y"
    : reports && !reports.length
      ? "No earnings reports"
      : reports && ready && !reportXs.length
        ? `None in the ${RANGE_WORD[range]}`
        : null;

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
            {fmtCcy(s[scrub].p, ccy)} · {ccy} · {tipLabel(s[scrub].t, range, s[scrub].x, dated)}
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
            <span className="hd-chart-ladder-when">{tipLabel(s[scrub].t, range, s[scrub].x, dated)}</span>
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
              spans ? ", with pre-market and after-hours trading" : ""
            }${
              lines.length ? ", with its 200-day average and the bands about it that it crosses" : ""
            }${
              reportXs.length
                ? `, marking ${reportXs.length} earnings ${reportXs.length === 1 ? "report" : "reports"}`
                : ""
            }`}
            onPointerDown={pick}
            onPointerMove={pick}
            onPointerUp={(e) => e.pointerType !== "mouse" && release()}
            onPointerCancel={release}
            onPointerLeave={release}
          >
            <defs>
              {/* The plot, where an average off the price's scale is cut off. */}
              <clipPath id={clipId}>
                <rect x={0} y={0} width={plotW + 1} height={PLOT_H} />
              </clipPath>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ds-accent)" stopOpacity=".24" />
                <stop offset="100%" stopColor="var(--ds-accent)" stopOpacity=".02" />
              </linearGradient>
            </defs>
            <SessionShade spans={spans} />
            <ValueGrid
              ticks={scale.ticks}
              width={width}
              plotW={plotW}
              live={ready && live ? { y: ys[last], label: live } : null}
            />
            <TimeGrid ticks={times} />
            {volume && <path d={volume} fill="none" stroke="var(--ds-muted)" strokeWidth={1.5} />}
            {ready && (
              <>
                {/* The bands' tints replace the price's fill, rather than mix with it. */}
                {zones.length ? (
                  <g clipPath={`url(#${clipId})`}>
                    {zones.map((z) => (
                      <path key={z.f} d={z.d} fill={z.color} fillOpacity={z.tint} />
                    ))}
                  </g>
                ) : (
                  fill && <path d={fill} fill={`url(#${gradId})`} />
                )}
                {/* Under the bands and the price: they mark when, not what. */}
                {reportXs.length > 0 && (
                  <path
                    d={reportXs.map((x) => `M${x} ${PLOT_TOP}V${PLOT_BOTTOM}`).join("")}
                    fill="none"
                    stroke="var(--ds-secondary)"
                    strokeWidth={1}
                  />
                )}
                <g clipPath={`url(#${clipId})`}>
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
                </g>
                {labels.map((l) => (
                  <text key={l.label} className="chart-band-label" x={l.x} y={l.y} dy="0.35em">
                    {l.label}
                  </text>
                ))}
                {/* Faded where it runs through extended hours, the regular
                    session drawn over it at full strength. */}
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
                    {/* The readout still lists an average off the scale; only its dot is cut off. */}
                    <g clipPath={`url(#${clipId})`}>
                      {lineRungs.map((r) => (
                        <circle key={r.label} cx={xs[scrub]} cy={plotY(r.v, lo, hi)} r={2.5} fill={r.color} />
                      ))}
                    </g>
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
        <span className="hd-indicator-group">
          <button
            type="button"
            className="hd-indicator"
            aria-pressed={bandsOn}
            onClick={() => setBandsOn(!bandsOn)}
          >
            {/* A band above the average, the average, a band below, as the chart stacks them. */}
            <span className="hd-indicator-bands" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            SMA bands
            {bandsOn && gap != null && <span className="hd-indicator-value">{fmtSignedPct(gap)}</span>}
          </button>
          {smaFailed ? (
            <span className="hd-indicator-note">Average unavailable</span>
          ) : (
            stayed && <span className="hd-indicator-note">{stayed}</span>
          )}
        </span>
        <span className="hd-indicator-group">
          <button
            type="button"
            className="hd-indicator"
            aria-pressed={earningsOn}
            disabled={!earningsFits}
            onClick={() => setEarningsOn(!earningsOn)}
          >
            {/* One upright line, as the chart marks each report. */}
            <span className="hd-indicator-earnings" aria-hidden="true" />
            Earnings
          </button>
          {earningsNote && <span className="hd-indicator-note">{earningsNote}</span>}
        </span>
      </div>
    </>
  );
}
