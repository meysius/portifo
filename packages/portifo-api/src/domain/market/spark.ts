import type { ChartMetaTradingPeriods } from "yahoo-finance2/modules/chart";

// A watchlist row's line: one trading day of 5-minute closes, placed on that
// day's own clock, so a line mid-session stops at the time of its latest bar
// and the symbols of one market line up down the list. All times epoch ms.
export type Spark = {
  // The span the line is drawn across: the regular session, or with
  // `extended`, from the pre-market's start to the after-hours' end. A market
  // that never closes (crypto, FX) has no day to draw: it gets the 24 hours to
  // its latest bar, and `rolling`.
  start: number;
  end: number;
  // The regular session within the span; bars outside it are extended hours.
  open: number;
  close: number;
  // [time, close], oldest first, thinned to at most MAX_POINTS.
  points: [number, number][];
  rolling?: true;
};

// What buildSpark reads of yahoo-finance2's chart result.
export type ChartLike = {
  meta: { tradingPeriods?: unknown };
  quotes: { date: Date; close: number | null }[];
};

// A row's line is about 64px wide: a 5-minute day's 78 bars (192 with
// extended hours) are more than it can show.
const MAX_POINTS = 100;
const DAY_MS = 86_400_000;
// Within a session bars are 5 minutes apart; a longer gap is a night.
const SESSION_GAP_MS = 2 * 3_600_000;
// A "session" this long is a market that never closes.
const ROUND_THE_CLOCK_MS = 23 * 3_600_000;

type Day = { start: number; open: number; close: number; end: number };

// The latest trading day the bars reach. `result` is a chart of the last few
// days at 5-minute bars, with pre-market and after-hours bars when `extended`.
export function buildSpark(result: ChartLike, extended: boolean): Spark | null {
  const bars = result.quotes
    .filter((q) => q.close != null && q.close > 0)
    .map((q): [number, number] => [q.date.getTime(), q.close as number]);
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1][0];
  const days = tradingDays(result.meta.tradingPeriods);

  if (days.some((d) => d.close - d.open >= ROUND_THE_CLOCK_MS)) {
    const start = last - DAY_MS;
    return spark({ start, open: start, close: last, end: last }, bars, true);
  }

  // The day the last bar falls in. In the first minutes of a session (or of
  // a pre-market) there is one bar or none, nothing to draw a line through,
  // so the day before stands until there are two.
  const from = (d: Day) => (extended ? d.start : d.open);
  const to = (d: Day) => (extended ? d.end : d.close);
  let i = days.findLastIndex((d) => from(d) <= last);
  if (i > 0 && bars.filter(([t]) => t >= from(days[i]) && t <= to(days[i])).length < 2) i--;
  if (i >= 0) {
    const d = days[i];
    const found = spark(extended ? d : { start: d.open, open: d.open, close: d.close, end: d.close }, bars);
    if (found) return found;
  }

  // Yahoo marked out no day: the last session, everything after the last
  // overnight gap, on its own span.
  let first = bars.length - 1;
  while (first > 0 && bars[first][0] - bars[first - 1][0] <= SESSION_GAP_MS) first--;
  const start = bars[first][0];
  return spark({ start, open: start, close: last, end: last }, bars);
}

function spark(day: Day, bars: [number, number][], rolling = false): Spark | null {
  const within = bars.filter(([t]) => t >= day.start && t <= day.end);
  if (within.length < 2) return null;
  return { ...day, points: thin(within), ...(rolling ? { rolling: true as const } : {}) };
}

// Every nth bar, and always the last, so the line still ends at the latest.
function thin(points: [number, number][]): [number, number][] {
  if (points.length <= MAX_POINTS) return points;
  const step = Math.ceil(points.length / MAX_POINTS);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

// Yahoo marks out each day's sessions: as an object of pre, regular and post
// lists for a listing that trades outside regular hours, else as a list of
// regular sessions alone.
function tradingDays(periods: unknown): Day[] {
  if (!periods) return [];
  const p = (Array.isArray(periods) ? { regular: periods } : periods) as Partial<ChartMetaTradingPeriods>;
  const spans = (list: unknown) =>
    ((list ?? []) as { start: unknown; end: unknown }[][]).flat().map((s) => ({ start: toMs(s.start), end: toMs(s.end) }));
  // A pre-market ends at its day's open; an after-hours starts at its close.
  const pre = new Map(spans(p.pre).map((s) => [s.end, s.start]));
  const post = new Map(spans(p.post).map((s) => [s.start, s.end]));
  return spans(p.regular)
    .filter((r) => r.end > r.start)
    .map((r) => ({ start: pre.get(r.start) ?? r.start, open: r.start, close: r.end, end: post.get(r.end) ?? r.end }))
    .sort((a, b) => a.start - b.start);
}

// Yahoo's trading periods arrive as epoch seconds or as Dates, whatever the
// schema says.
function toMs(t: unknown): number {
  return typeof t === "number" ? t * 1000 : new Date(t as string | Date).getTime();
}
