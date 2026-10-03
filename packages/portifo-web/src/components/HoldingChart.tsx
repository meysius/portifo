import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { getHistory } from "../api/market";
import type { HistoryPoint, HistoryRange, Quote } from "../api/market";
import { fmtCcy, fmtDay, fmtSignedCcy, fmtSignedPct } from "../lib/fx";

// Holding Detail's price chart. It is not the Portfolio chart (PriceChart): that
// one plots a total, this one plots a share price against the user's own
// trades — buy/sell dots at the price paid, and a dashed avg-cost line — so
// "where did I buy versus where is it now" reads without leaving the screen.
// Hand-drawn SVG: the markers and the labelled reference line are the point,
// and both are a few lines here.

const RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "1Y", "5Y", "All"];
const RANGE_WORD: Partial<Record<HistoryRange, string>> = {
  "1D": "today",
  "1W": "past week",
  "1M": "past month",
  "3M": "past 3 months",
  "1Y": "past year",
  "5Y": "past 5 years",
  All: "all time",
};

const H = 170;
const PT = 12;
const PB = 12;

export type TradeMark = { date: Date; type: "buy" | "sell"; price: number };

type Pt = { t: number; p: number };

const tone = (n: number) => (n > 1e-9 ? "gain" : n < -1e-9 ? "loss" : "");
const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// Last-fetched series per symbol+range, so flipping back to a range (or pushing
// the same holding again) redraws at once instead of flashing a skeleton.
const cache = new Map<string, Pt[]>();

export default function HoldingChart({
  symbol,
  quote,
  avgCost,
  marks,
}: {
  symbol: string;
  quote: Quote;
  // null hides the line: a closed position has no cost, and a ledger in a
  // different currency than the quote would put it on the wrong scale.
  avgCost: number | null;
  marks: TradeMark[];
}) {
  const ccy = quote.currency;
  const [range, setRange] = useState<HistoryRange>("1Y");
  const [pts, setPts] = useState<Pt[] | null>(() => cache.get(`${symbol}|1Y`) ?? null);
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

  const is1D = range === "1D";
  const prevClose = quote.previousClose ?? quote.price - quote.change;
  const s = pts ?? [];
  const ready = s.length > 1 && width > 0;

  // ── geometry ─────────────────────────────────────────────────────────────
  let path = "";
  let x = (_t: number) => 0;
  let y = (_p: number) => 0;
  let t0 = 0;
  let t1 = 0;
  let lo = 0;
  let hi = 0;
  const ref = is1D ? { v: prevClose, label: "Prev close" } : avgCost != null ? { v: avgCost, label: "Avg cost" } : null;
  let refOnChart = false;
  let shownMarks: TradeMark[] = [];
  if (ready) {
    t0 = s[0].t;
    t1 = s[s.length - 1].t;
    lo = Math.min(...s.map((p) => p.p));
    hi = Math.max(...s.map((p) => p.p));
    const span = hi - lo || hi * 0.02;
    // Stretch the scale to take the reference line in when it is near; when it
    // is far off, the curve keeps its own scale and the line becomes an arrow.
    if (ref && ref.v > lo - span * 0.6 && ref.v < hi + span * 0.6) {
      lo = Math.min(lo, ref.v);
      hi = Math.max(hi, ref.v);
    }
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
    x = (t) => ((t - t0) / (t1 - t0 || 1)) * width;
    y = (p) => PT + (1 - (p - lo) / (hi - lo)) * (H - PT - PB);
    path = s.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.p).toFixed(1)}`).join("");
    refOnChart = !!ref && ref.v >= lo && ref.v <= hi;
    // A ledger date is a day; its mark belongs at that day's bar.
    shownMarks = is1D ? [] : marks.filter((m) => +m.date >= t0 - 864e5 && +m.date <= t1);
  }

  // ── readout ──────────────────────────────────────────────────────────────
  const base = is1D ? prevClose : ready ? s[0].p : prevClose;
  const sp = scrub != null && ready ? s[scrub] : null;
  const shownPrice = sp ? sp.p : quote.price;
  const ch = shownPrice - base;
  const chPct = base ? (ch / base) * 100 : 0;
  const word = sp ? `since ${is1D ? "prev close" : fmtDay(new Date(t0))}` : ready || is1D ? RANGE_WORD[range] : "today";

  let asof: [string, string] | null = null;
  if (sp) asof = [is1D ? fmtTime(sp.t) : fmtDay(new Date(sp.t)), ""];
  else if (quote.marketState === "REGULAR") asof = ["Market open", quote.marketTime ? `as of ${fmtTime(+new Date(quote.marketTime))}` : ""];
  else if (quote.marketState) asof = ["Market closed", quote.marketTime ? `${fmtShort(new Date(quote.marketTime))} close` : ""];

  const pick = (e: ReactPointerEvent) => {
    if (!ready || !wrapRef.current) return;
    const bx = wrapRef.current.getBoundingClientRect();
    const px = Math.max(0, Math.min(width, e.clientX - bx.left));
    const t = t0 + (px / width) * (t1 - t0);
    let i = 0;
    while (i < s.length - 1 && s[i + 1].t <= t) i++;
    if (i < s.length - 1 && t - s[i].t > s[i + 1].t - t) i++;
    setScrub(i);
  };
  const release = () => setScrub(null);

  return (
    <section className="hd-sec">
      <div className="hd-pricehead">
        <div>
          <div className="hd-lbl">Share price</div>
          <div className="hd-price num">{fmtCcy(shownPrice, ccy)}</div>
          <div className="hd-pricechg">
            <span className={`num ${tone(ch)}`}>{fmtSignedCcy(ch, ccy)}</span>{" "}
            <span className={`num ${tone(ch)}`}>{fmtSignedPct(chPct)}</span> <span className="hd-dim">{word}</span>
          </div>
        </div>
        {asof && (
          <div className="hd-asof">
            {asof[0]}
            {asof[1] && <br />}
            {asof[1]}
          </div>
        )}
      </div>

      <div
        ref={wrapRef}
        className="hd-chart"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          // Mouse hover scrubs too; a touch only scrubs while down (captured).
          if (e.pointerType === "mouse" || e.currentTarget.hasPointerCapture(e.pointerId)) pick(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        {!ready && !failed && <div className="hd-sk" style={{ height: H, borderRadius: 10 }} />}
        {!ready && failed && <div className="hd-chart-empty">Price history unavailable</div>}
        {ready && (
          <svg width={width} height={H} aria-label={`${symbol} price, ${RANGE_WORD[range]}`}>
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--signal)" stopOpacity=".16" />
                <stop offset="1" stopColor="var(--signal)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${path}L${width},${H}L0,${H}Z`} fill={`url(#${gradId})`} />
            {ref && refOnChart && (
              <>
                <line x1={0} x2={width} y1={y(ref.v)} y2={y(ref.v)} stroke="var(--fg-3)" strokeDasharray="3 4" strokeWidth={1} />
                <text x={width} y={y(ref.v) - 5} textAnchor="end" className="hd-reftext">
                  {ref.label} {fmtCcy(ref.v, ccy)}
                </text>
              </>
            )}
            {ref && !refOnChart && (
              <text x={width} y={ref.v > hi ? 9 : H - 1} textAnchor="end" className="hd-reftext">
                {ref.label} {fmtCcy(ref.v, ccy)} {ref.v > hi ? "↑" : "↓"}
              </text>
            )}
            <path d={path} fill="none" stroke="var(--signal)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
            {shownMarks.map((m, i) =>
              m.type === "buy" ? (
                <circle key={i} cx={x(Math.max(+m.date, t0))} cy={y(m.price)} r={4} fill="var(--signal)" stroke="var(--bg)" strokeWidth={2} />
              ) : (
                <circle key={i} cx={x(Math.max(+m.date, t0))} cy={y(m.price)} r={3.6} fill="var(--bg)" stroke="var(--fg-1)" strokeWidth={1.6} />
              ),
            )}
            {sp && (
              <g>
                <line x1={x(sp.t)} x2={x(sp.t)} y1={0} y2={H} stroke="var(--fg-3)" strokeWidth={1} />
                <circle cx={x(sp.t)} cy={y(sp.p)} r={4.5} fill="var(--signal)" stroke="var(--bg)" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}
      </div>

      {ready && (
        <div className="hd-xlab">
          <span>{is1D ? fmtTime(t0) : fmtDay(new Date(t0))}</span>
          <span>{is1D ? fmtTime(t1) : fmtDay(new Date(t1))}</span>
        </div>
      )}

      <div className="hd-ranges" role="group" aria-label="Chart range">
        {RANGES.map((r) => (
          <button key={r} type="button" aria-pressed={r === range} onClick={() => setRange(r)}>
            {r}
          </button>
        ))}
      </div>

      {ready && (shownMarks.length > 0 || ref) && (
        <div className="hd-legend">
          {shownMarks.some((m) => m.type === "buy") && (
            <span>
              <i className="hd-lg-buy" />
              Buy
            </span>
          )}
          {shownMarks.some((m) => m.type === "sell") && (
            <span>
              <i className="hd-lg-sell" />
              Sell
            </span>
          )}
          {ref && (
            <span>
              <i className="hd-lg-ref" />
              {ref.label}
            </span>
          )}
        </div>
      )}

      <div className="hd-daystats">
        <div>
          <div className="k">Open</div>
          <div className="v num">{fmtCcy(quote.open, ccy)}</div>
        </div>
        <div>
          <div className="k">High</div>
          <div className="v num">{fmtCcy(quote.dayHigh, ccy)}</div>
        </div>
        <div>
          <div className="k">Low</div>
          <div className="v num">{fmtCcy(quote.dayLow, ccy)}</div>
        </div>
        <div>
          <div className="k">Volume</div>
          <div className="v num">{compact(quote.volume)}</div>
        </div>
      </div>
    </section>
  );
}
