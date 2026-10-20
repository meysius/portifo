import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { getIntraday } from "../api/market";
import type { Intraday, Quote } from "../api/market";
import { CHART_H, PLOT_H, plotY, timeAxis, valueAxis, volumePath } from "../lib/chartAxis";
import { fmtCcy, fmtMoney } from "../lib/fx";
import TimeGrid from "./TimeGrid";
import ValueGrid from "./ValueGrid";

// Holding Detail's 1D chart: the last session as 5-minute candles, kept
// live. The time scale spans the session's full hours (the exchange's own,
// as Yahoo gives them), so the day fills in from the left as it trades
// rather than stretching to fit; the price scale fits the session's low and
// high. A candle that closed at or above its open is ds-positive, one that
// closed below it ds-negative. Volume runs beneath, as on the other ranges.
//
// While the market is open and the chart is on screen, it asks every 5
// seconds for the candles from the forming one on, and hands the quote that
// comes with them to the page, so the share price and returns above move
// with the candles. Closed, it looks once a minute, to catch the open. A
// failed poll backs off, up to a minute, and the chart keeps what it has.

const CANDLE_MS = 5 * 60_000;
const POLL_OPEN_MS = 5_000;
const POLL_IDLE_MS = 60_000;

type Bar = { t: number; date: string; o: number; h: number; l: number; c: number; v: number };
type Day = { start: number; end: number; bars: Bar[] };

// The session as last drawn, per symbol, so returning to 1D redraws at once.
const cache = new Map<string, Day>();

// A poll's candles replace the forming one and follow it; a new session
// replaces the day.
function merge(held: Day | undefined, reply: Intraday): Day {
  const start = Date.parse(reply.start);
  const fresh = reply.candles.map((k) => ({
    t: Date.parse(k.date),
    date: k.date,
    o: k.open,
    h: k.high,
    l: k.low,
    c: k.close,
    v: k.volume,
  }));
  if (!held || held.start !== start) return { start, end: Date.parse(reply.end), bars: fresh };
  const from = fresh.length ? fresh[0].t : Infinity;
  return { ...held, bars: [...held.bars.filter((b) => b.t < from), ...fresh] };
}

// On screen: the app in the foreground, its page on top (Ionic hides the
// pages under it) and the chart not scrolled away.
function useOnScreen(ref: RefObject<Element | null>) {
  const [inView, setInView] = useState(false);
  const [foreground, setForeground] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    const onChange = () => setForeground(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onChange);
    };
  }, [ref]);
  return inView && foreground;
}

const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function CandleChart({
  symbol,
  ccy,
  width,
  onQuote,
}: {
  symbol: string;
  ccy: string;
  width: number;
  onQuote?: (quote: Quote) => void;
}) {
  const [day, setDay] = useState<Day | null>(() => cache.get(symbol) ?? null);
  const [failed, setFailed] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(boxRef);
  // Read at each poll, so a new callback doesn't restart the polling.
  const quoteRef = useRef(onQuote);
  useEffect(() => {
    quoteRef.current = onQuote;
  });

  useEffect(() => {
    if (!onScreen) return;
    let live = true;
    let timer: number | undefined;
    let failures = 0;
    const poll = async () => {
      let wait = POLL_IDLE_MS;
      try {
        const held = cache.get(symbol);
        const reply = await getIntraday(symbol, held?.bars.at(-1)?.date);
        if (!live) return;
        const next = merge(held, reply);
        cache.set(symbol, next);
        setDay(next);
        setFailed(false);
        if (reply.quote) quoteRef.current?.(reply.quote);
        failures = 0;
        if (reply.quote?.marketState === "REGULAR") wait = POLL_OPEN_MS;
      } catch {
        if (!live) return;
        failures++;
        if (!cache.has(symbol)) setFailed(true);
        wait = Math.min(POLL_IDLE_MS, POLL_OPEN_MS * 2 ** failures);
      }
      timer = window.setTimeout(poll, wait);
    };
    poll();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [symbol, onScreen]);

  const bars = day?.bars ?? [];
  const ready = !!day && bars.length > 0 && width > 0;
  let scale = valueAxis(0, 0);
  let plotW = width;
  let slotW = 0;
  let xs: number[] = [];
  let times: ReturnType<typeof timeAxis> = [];
  let volume = "";
  const wicks = { up: "", down: "" };
  const bodies = { up: "", down: "" };
  if (ready) {
    const lo = Math.min(...bars.map((b) => b.l));
    const hi = Math.max(...bars.map((b) => b.h));
    scale = valueAxis(lo, hi);
    plotW = width - scale.width;
    const slots = Math.max(1, Math.round((day.end - day.start) / CANDLE_MS));
    slotW = plotW / slots;
    const bodyW = Math.min(9, Math.max(1, slotW * 0.7));
    xs = bars.map((b) => (Math.floor((b.t - day.start) / CANDLE_MS) + 0.5) * slotW);
    bars.forEach((b, i) => {
      const side = b.c >= b.o ? "up" : "down";
      const top = plotY(Math.max(b.o, b.c), lo, hi);
      const height = Math.max(1, plotY(Math.min(b.o, b.c), lo, hi) - top);
      wicks[side] += `M${xs[i].toFixed(1)} ${plotY(b.h, lo, hi).toFixed(1)}V${plotY(b.l, lo, hi).toFixed(1)}`;
      bodies[side] += `M${(xs[i] - bodyW / 2).toFixed(1)} ${top.toFixed(1)}h${bodyW.toFixed(1)}v${height.toFixed(1)}h-${bodyW.toFixed(1)}Z`;
    });
    volume = volumePath(xs, bars.map((b) => b.v));
    // Every slot of the session, so the hour guides span the whole day.
    const stamps = Array.from({ length: slots }, (_, i) => day.start + i * CANDLE_MS);
    times = timeAxis(stamps, stamps.map((_, i) => i * slotW), "1D", width);
  }

  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!ready) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    // The candle under the finger; right of the last one, the last one.
    setScrub(Math.max(0, xs.findLastIndex((x) => x - slotW / 2 <= px)));
  };
  const release = () => setScrub(null);
  // A new session can leave fewer candles than the one scrubbed.
  const bar = ready && scrub != null ? bars[scrub] : undefined;

  return (
    <div ref={boxRef}>
      {bar && scrub != null && (
        <div
          className="hd-chart-tip"
          style={{ left: xs[scrub], transform: `translateX(-${(xs[scrub] / plotW) * 100}%)` }}
        >
          {fmtCcy(bar.c, ccy)} · {ccy} · {fmtTime(bar.t)}
          <span className="hd-chart-tip-ohlc money">
            O {fmtMoney(bar.o)} H {fmtMoney(bar.h)} L {fmtMoney(bar.l)}
          </span>
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
          aria-label={`${symbol} share price today, in 5-minute candles`}
          onPointerDown={pick}
          onPointerMove={pick}
          onPointerUp={(e) => e.pointerType !== "mouse" && release()}
          onPointerCancel={release}
          onPointerLeave={release}
        >
          <ValueGrid ticks={scale.ticks} width={width} plotW={plotW} />
          <TimeGrid ticks={times} />
          {volume && <path d={volume} fill="none" stroke="var(--ds-muted)" strokeWidth={1.5} />}
          <path d={wicks.up} fill="none" stroke="var(--ds-positive)" strokeWidth={1} />
          <path d={wicks.down} fill="none" stroke="var(--ds-negative)" strokeWidth={1} />
          <path d={bodies.up} fill="var(--ds-positive)" />
          <path d={bodies.down} fill="var(--ds-negative)" />
          {bar && scrub != null && (
            <line
              x1={xs[scrub]}
              x2={xs[scrub]}
              y1={0}
              y2={PLOT_H}
              stroke="var(--ds-muted)"
              strokeDasharray="2 3"
            />
          )}
        </svg>
      )}
    </div>
  );
}
