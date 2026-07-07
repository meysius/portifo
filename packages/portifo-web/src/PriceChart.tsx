import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AreaSeries, createChart, LineStyle, TrackingModeExitMode } from "lightweight-charts";
import type { IChartApi, IPriceLine, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { HistoryPoint, HistoryRange } from "./api/market";
import { fmtCcy } from "./lib/fx";
import { useResolvedDark } from "./lib/theme";

export const CHART_RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "All"];

export function RangePicker({ range, onChange }: { range: HistoryRange; onChange: (r: HistoryRange) => void }) {
  return (
    <div className="ranges">
      {CHART_RANGES.map((r) => (
        <button key={r} type="button" className={r === range ? "on" : ""} onClick={() => onChange(r)}>
          {r}
        </button>
      ))}
    </div>
  );
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Mirrors the Apple Stocks convention: the whole chart reads as green or red
// based on the net move across the loaded range, not a fixed accent color.
function seriesColors(points: HistoryPoint[]) {
  const isUp = points.length < 2 || points[points.length - 1].close >= points[0].close;
  const color = cssVar(isUp ? "--gain" : "--loss");
  return { lineColor: color, topColor: `${color}33`, bottomColor: `${color}00` };
}

function toChartData(points: HistoryPoint[]) {
  return points.map((p) => ({
    time: Math.floor(new Date(p.date).getTime() / 1000) as UTCTimestamp,
    value: p.close,
  }));
}

type Scrub = { x: number; value: number; date: string; delta: number; deltaPct: number };

function PriceChart({ points, currency = "USD" }: { points: HistoryPoint[]; currency?: string }) {
  // Colors are read from CSS vars imperatively, so a theme flip while the
  // chart stays mounted (Ionic keeps tab pages alive) must re-apply them.
  const dark = useResolvedDark();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const baselineRef = useRef<IPriceLine | null>(null);

  // The point currently under the crosshair while the user taps/drags across
  // the chart — null when not scrubbing. Drives the floating readout below.
  const [scrub, setScrub] = useState<Scrub | null>(null);
  // Whether the loaded range is sub-daily (intraday), so the readout can show
  // the time of day rather than just a date. Kept in a ref so the crosshair
  // subscription (registered once) always reads the latest value.
  const intradayRef = useRef(false);
  // First close of the loaded range, so the crosshair subscription (registered
  // once) can compute "change since range start" for whatever point is scrubbed.
  const rangeStartRef = useRef(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: cssVar("--fg-3"), attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: {
        vertLine: { color: cssVar("--border"), width: 1, style: LineStyle.Dashed, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
      // Touch: show the crosshair the moment a finger lands and keep it
      // tracking the drag until the finger lifts, instead of the default
      // "tap to place, tap again to dismiss" — this is the scrubbing gesture.
      trackingMode: { exitMode: TrackingModeExitMode.OnTouchEnd },
    });

    const series = chart.addSeries(AreaSeries, {
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerRadius: 5,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // While tapping/dragging, publish the point under the crosshair so the
    // floating readout can show that historical value and date; clear it when
    // the crosshair leaves the series (touch lifted, or pointer off-chart).
    chart.subscribeCrosshairMove((param) => {
      const s = seriesRef.current;
      if (!s || !param.point || param.time === undefined) {
        setScrub(null);
        return;
      }
      const data = param.seriesData.get(s) as { value?: number } | undefined;
      if (!data || data.value === undefined) {
        setScrub(null);
        return;
      }
      const d = new Date((param.time as number) * 1000);
      const date = intradayRef.current
        ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const start = rangeStartRef.current;
      const delta = start ? data.value - start : 0;
      const deltaPct = start ? (delta / start) * 100 : 0;
      setScrub({ x: param.point.x, value: data.value, date, delta, deltaPct });
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      baselineRef.current = null;
      setScrub(null);
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    chartRef.current?.applyOptions({
      layout: { textColor: cssVar("--fg-3") },
      crosshair: { vertLine: { color: cssVar("--border") } },
    });

    const spanMs =
      points.length > 1 ? new Date(points[points.length - 1].date).getTime() - new Date(points[0].date).getTime() : 0;
    intradayRef.current = points.length > 1 && spanMs > 0 && spanMs < 3 * 86_400_000;

    rangeStartRef.current = points.length > 0 ? points[0].close : 0;

    const data = toChartData(points);
    series.setData(data);
    series.applyOptions(seriesColors(points));
    chartRef.current?.timeScale().fitContent();
    // A range switch invalidates any active scrub position.
    setScrub(null);

    if (baselineRef.current) {
      series.removePriceLine(baselineRef.current);
      baselineRef.current = null;
    }
    if (points.length > 1) {
      baselineRef.current = series.createPriceLine({
        price: points[0].close,
        color: cssVar("--border"),
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "",
      });
    }
  }, [points, dark]);

  // Keep the floating readout inside the canvas: it's centered on the crosshair
  // but clamped so a point near either edge doesn't push the label off-frame.
  const width = containerRef.current?.clientWidth ?? 0;
  const clampedX = scrub ? Math.min(Math.max(scrub.x, 52), Math.max(52, width - 52)) : 0;

  // Change across the whole loaded range, shown as a standing badge so the
  // trend reads as a number even before the user starts scrubbing.
  const rangeChange = points.length > 1 ? points[points.length - 1].close - points[0].close : 0;
  const rangeChangePct = points.length > 1 && points[0].close ? (rangeChange / points[0].close) * 100 : 0;

  return (
    <div className="chart-canvas" aria-label="Price history">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {!scrub && points.length > 1 && (
        <div className={`chart-range-badge ${rangeChange >= 0 ? "positive" : "negative"}`}>
          {rangeChange >= 0 ? "+" : "−"}
          {fmtCcy(Math.abs(rangeChange), currency)} · {Math.abs(rangeChangePct).toFixed(1)}%
        </div>
      )}
      {scrub && (
        <div className="chart-scrub" style={{ left: clampedX }}>
          <span className="chart-scrub-val">{fmtCcy(scrub.value, currency)}</span>
          <span className={`chart-scrub-delta ${scrub.delta >= 0 ? "positive" : "negative"}`}>
            {scrub.delta >= 0 ? "+" : "−"}
            {fmtCcy(Math.abs(scrub.delta), currency)} · {Math.abs(scrub.deltaPct).toFixed(1)}%
          </span>
          <span className="chart-scrub-date">{scrub.date}</span>
        </div>
      )}
    </div>
  );
}

export default PriceChart;
