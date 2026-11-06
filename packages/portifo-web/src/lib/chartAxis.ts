import type { HistoryRange } from "../api/market";

// Shared geometry for the line charts (GrowthChart, HoldingChart), modelled on
// Apple Stocks: a tall plot fitted to the series' own low and high, so the low
// touches the baseline and the high reaches the top, split into four equal
// bands whose top edges are labelled in a column at the right. The labels keep
// the stretch honest: a 1% wobble fills the plot exactly as a 50% run does,
// and only the scale beside it tells them apart.
//
// Points sit at equal steps, not at their timestamps, so the market's closed
// hours take no width: a week is five equal sessions, as Apple draws it, not
// five slivers joined by straight overnight lines. Beneath the plot runs a row
// of time labels, each beside a vertical guide where its hour, session, week,
// month or year begins.

export const PLOT_H = 168;
export const PLOT_TOP = 4; // room for the latest-value dot
export const PLOT_BOTTOM = PLOT_H - 1;
export const AXIS_H = 24; // the time labels' row, under the plot
const BANDS = 4;

// Both axes' labels are JetBrains Mono at --ds-fs-10 (10px × 1.2), which
// advances 0.6em a character.
const CHAR_W = 7.2;
const AXIS_GAP = 8;
export const LABEL_INSET = 5; // a time label's gap from its guide

export type ValueTick = { y: number; label: string };
export type TimeTick = { x: number; label: string };
// A bar struck outside the regular session, on a 1D with extended hours.
// Overnight is only ever the latest trade, streamed: Yahoo's chart has none.
export type Session = "pre" | "post" | "overnight";

// How strongly the price line reads where it runs through extended hours.
export const EXTENDED_OPACITY = 0.4;

// Few enough digits to read at a glance, enough that neighbours differ:
// 241 / 222 / 202, 63.1K / 62.8K, 0.0123.
function axisFormatter(hi: number, step: number) {
  const mag = Math.abs(hi);
  const unit = mag >= 1e6 ? 1e6 : mag >= 1e4 ? 1e3 : 1;
  const suffix = unit === 1e6 ? "M" : unit === 1e3 ? "K" : "";
  const digits = Math.min(unit > 1 ? 2 : 4, Math.max(0, Math.ceil(-Math.log10(step / unit))));
  return (v: number) =>
    (v / unit).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + suffix;
}

// The line through points from…to (all of them by default), at their places.
export function linePath(xs: number[], ys: number[], from = 0, to = xs.length - 1) {
  let d = "";
  for (let i = from; i <= to; i++) d += `${i > from ? "L" : "M"}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`;
  return d;
}

// Where a 1D's extended hours lie on the plot: the regular session's first
// and last bar (-1 when it hasn't opened), and the stretches before its open
// and after its close, each edge midway between the session's outermost bar
// and its neighbour, on a whole pixel. Null when every bar is the regular
// session's.
export type SessionSpans = { open: number; close: number; shade: [number, number][] };

export function sessionSpans(sessions: (Session | undefined)[], xs: number[], plotW: number): SessionSpans | null {
  if (!sessions.some(Boolean)) return null;
  const open = sessions.findIndex((s) => !s);
  const close = sessions.findLastIndex((s) => !s);
  if (open < 0) return { open, close, shade: [[0, plotW]] };
  const shade: [number, number][] = [];
  if (open > 0) shade.push([0, Math.round((xs[open - 1] + xs[open]) / 2)]);
  if (close < xs.length - 1) shade.push([Math.round((xs[close] + xs[close + 1]) / 2), plotW]);
  return { open, close, shade };
}

// On 1D the latest price is tagged on the value scale, at the line's end: a
// pill of the line's colour, so the price now reads at a glance wherever it
// sits between the scale's four values. To a price's precision, without the
// currency (the scale has none): whole above a thousand, cents above one,
// four places below.
export const LIVE_TAG_H = 18;
export const LIVE_TAG_PAD = 5;
const LIVE_TAG_GAP = 4; // from the plot's edge

export function liveLabel(v: number) {
  const digits = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 1 ? 2 : 4;
  return v
    .toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace(/^-/, "−");
}

export function liveTagWidth(label: string) {
  return label.length * CHAR_W + 2 * LIVE_TAG_PAD;
}

// The value column's width with the tag in it: wide enough for the scale's
// labels and the tag both.
export function valueColumnWidth(scaleWidth: number, live: string | null) {
  return live ? Math.max(scaleWidth, liveTagWidth(live) + LIVE_TAG_GAP) : scaleWidth;
}

export function plotY(v: number, lo: number, hi: number) {
  return hi > lo ? PLOT_BOTTOM - ((v - lo) / (hi - lo)) * (PLOT_BOTTOM - PLOT_TOP) : (PLOT_TOP + PLOT_BOTTOM) / 2;
}

// The guides from the top down, and the width the label column takes from the
// plot. A flat series gets neither.
export function valueAxis(lo: number, hi: number): { ticks: ValueTick[]; width: number } {
  if (!(hi > lo)) return { ticks: [], width: 0 };
  const step = (hi - lo) / BANDS;
  const fmt = axisFormatter(hi, step);
  const ticks = Array.from({ length: BANDS }, (_, k) => ({
    y: PLOT_TOP + (k * (PLOT_BOTTOM - PLOT_TOP)) / BANDS,
    label: fmt(hi - k * step),
  }));
  return { ticks, width: Math.max(...ticks.map((t) => t.label.length)) * CHAR_W + AXIS_GAP };
}

const HOUR = 3_600_000;

// The label for point i if a new unit begins there, else null. A 1W series is
// cut into sessions by its overnight gaps rather than by calendar date, so a
// session that crosses local midnight still reads as one day.
function unitStart(times: number[], i: number, range: HistoryRange): string | null {
  const d = new Date(times[i]);
  if (i === 0) {
    if (range === "1W") return String(d.getDate());
    if (range === "1D" && d.getMinutes() === 0) return String(d.getHours() % 12 || 12);
    return null; // a range rarely opens on a week, month or year
  }
  const prev = new Date(times[i - 1]);
  switch (range) {
    case "1D":
      return d.getHours() !== prev.getHours() ? String(d.getHours() % 12 || 12) : null;
    case "1W":
      return times[i] - times[i - 1] > 2 * HOUR ? String(d.getDate()) : null;
    case "1M":
      return d.getDay() < prev.getDay() || times[i] - times[i - 1] >= 7 * 24 * HOUR ? String(d.getDate()) : null;
    case "3M":
    case "6M":
    case "1Y":
      return d.getMonth() !== prev.getMonth() ? d.toLocaleDateString("en-US", { month: "short" }) : null;
    default:
      return d.getFullYear() !== prev.getFullYear() ? String(d.getFullYear()) : null;
  }
}

// Where each hour (1D), session (1W), week (1M), month (3M, 6M, 1Y) or year (2Y, 5Y, All)
// begins. When they crowd (a year's twelve months, a decade's years), every
// second or third is kept, evenly. A unit that begins on the last point spans
// nothing, so it gets no guide.
export function timeAxis(times: number[], xs: number[], range: HistoryRange, width: number): TimeTick[] {
  const ticks: TimeTick[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    const label = unitStart(times, i, range);
    if (label) ticks.push({ x: xs[i], label });
  }
  const room = Math.max(0, ...ticks.map((t) => t.label.length)) * CHAR_W + 2 * LABEL_INSET;
  let every = 1;
  while (ticks.some((t, j) => j >= every && j % every === 0 && t.x - ticks[j - every].x < room)) every++;
  return ticks.filter((t, j) => j % every === 0 && t.x + LABEL_INSET + t.label.length * CHAR_W <= width);
}
