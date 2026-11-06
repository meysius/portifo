import type { Quote, Spark } from "../api/market";
import { EXTENDED_OPACITY } from "../lib/chartAxis";
import { DAY_BAR_MS, latestTrade, withLatest } from "../lib/liveSeries";
import type { LivePoint } from "../lib/liveSeries";

// A watchlist row's line: the symbol's latest trading day, in ink, over a
// dashed line at the price today's move is measured from (the previous
// close), so where the line ends against it says up or down before the
// figures do. The day sits on its own clock, from the session's start to its
// end: mid-session the line stops at the latest trade, and symbols of one
// market stop at the same place down the list. With Extended hours on (the
// charts' setting) the day runs from the pre-market to the after-hours close,
// faded outside the regular session as the 1D chart draws it, and the latest
// overnight trade is one more point past it. A market that never closes
// (crypto, FX) shows its last 24 hours.
//
// The line runs on to the latest trade as the quote streams in. A regular
// trade past the day's end belongs to the next session, which the next fetch
// brings.

const W = 64;
const H = 30;
// Room above and below for the stroke and the end dot.
const PAD = 3;
const DAY_MS = 86_400_000;

export default function WatchSpark({ spark, quote, extended }: { spark?: Spark; quote?: Quote; extended: boolean }) {
  if (!spark || !quote) return <span className="wl-spark" aria-hidden="true" />;

  const bars: LivePoint[] = spark.points.map(([t, p]) => ({
    t,
    p,
    x: t < spark.open ? "pre" : t > spark.close ? "post" : undefined,
  }));
  const trade = latestTrade(quote, extended);
  const fits = trade && (spark.rolling || trade.t <= spark.end + DAY_BAR_MS || trade.x === "overnight");
  const all = withLatest(bars, fits ? trade : null);
  const last = all[all.length - 1].t;
  const [from, to] = spark.rolling ? [last - DAY_MS, last] : [spark.start, Math.max(spark.end, last)];
  const s = all.filter((p) => p.t >= from);
  if (s.length < 2 || !(to > from)) return <span className="wl-spark" aria-hidden="true" />;

  // The move's base: the previous close, or for crypto Yahoo's own 24-hour
  // reference, which only the quoted change gives away.
  const base = quote.change || !quote.previousClose ? quote.price - quote.change : quote.previousClose;
  const values = [...s.map((p) => p.p), base];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (t: number) => ((t - from) / (to - from)) * W;
  const y = (v: number) => (hi > lo ? PAD + ((hi - v) / (hi - lo)) * (H - 2 * PAD) : H / 2);
  const path = (pts: LivePoint[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.p).toFixed(1)}`).join("");

  // Outside the regular session the line is faded, the session drawn over it.
  const outside = s.some((p) => p.x);
  const first = s.findIndex((p) => !p.x);
  const end = s.findLastIndex((p) => !p.x);
  const regular = outside && first >= 0 ? path(s.slice(first, end + 1)) : "";
  // On a whole pixel, so the dashes stay crisp.
  const baseY = Math.round(y(base)) + 0.5;
  const tip = s[s.length - 1];

  return (
    <svg className="wl-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line x1={0} x2={W} y1={baseY} y2={baseY} className="wl-spark-base" />
      <path
        d={path(s)}
        className="wl-spark-line"
        strokeOpacity={outside ? EXTENDED_OPACITY : undefined}
      />
      {regular && <path d={regular} className="wl-spark-line" />}
      <circle cx={x(tip.t)} cy={y(tip.p)} r={2} className="wl-spark-dot" />
    </svg>
  );
}
