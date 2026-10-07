/* The line chart shared by holding-detail.html and portfolio-overview.html.
   It mirrors the app's (packages/portifo-web/src/lib/chartAxis.ts, with
   ValueGrid, TimeGrid and HoldingChart's volume strip), drawn the Apple
   Stocks way:
   - a 168px plot fitted to the series' own low and high, split into four
     bands whose top edges carry their value in a column at the right;
   - points at equal steps, so the market's closed hours take no width: a
     week is five equal sessions, not five slivers joined by overnight lines;
   - a row of time labels beneath, each beside a vertical guide where its
     hour, session, week, month or year begins;
   - optionally, the volume traded, as grey strokes under the labels.
   Both scales are primary ink at reading size; only the guides are faint.
   A classic script that exposes window.pocChart and reads no study state. */
(() => {
  const PLOT_H = 168, PLOT_TOP = 4, PLOT_BOTTOM = PLOT_H - 1, AXIS_H = 24, BANDS = 4;
  const AXIS_GAP = 8, INSET = 5, VOLUME_GAP = 8, VOLUME_H = 18, HOUR = 36e5;

  // Few enough digits to read at a glance, enough that neighbours differ:
  // 241 / 222 / 202, 63.1K / 62.8K, 0.0123.
  function axisFormatter(hi, step) {
    const mag = Math.abs(hi), unit = mag >= 1e6 ? 1e6 : mag >= 1e4 ? 1e3 : 1;
    const suffix = unit === 1e6 ? 'M' : unit === 1e3 ? 'K' : '';
    const digits = Math.min(unit > 1 ? 2 : 4, Math.max(0, Math.ceil(-Math.log10(step / unit))));
    return v => (v / unit).toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits}) + suffix;
  }
  const plotY = (v, lo, hi) => hi > lo ? PLOT_BOTTOM - (v - lo) / (hi - lo) * (PLOT_BOTTOM - PLOT_TOP) : (PLOT_TOP + PLOT_BOTTOM) / 2;

  // The guides from the top down, and the width the label column takes from
  // the plot. A flat series gets neither.
  function valueAxis(lo, hi, charW) {
    if (!(hi > lo)) return {ticks: [], width: 0};
    const step = (hi - lo) / BANDS, fmt = axisFormatter(hi, step);
    const ticks = Array.from({length: BANDS}, (_, k) => ({y: PLOT_TOP + k * (PLOT_BOTTOM - PLOT_TOP) / BANDS, label: fmt(hi - k * step)}));
    return {ticks, width: Math.max(...ticks.map(t => t.label.length)) * charW + AXIS_GAP};
  }

  // The label for point i if a new unit begins there, else null. A 1W series
  // is cut into sessions by its overnight gaps, not by calendar date.
  function unitStart(times, i, range) {
    const d = new Date(times[i]);
    if (i === 0) {
      if (range === '1W') return String(d.getDate());
      if (range === '1D' && d.getMinutes() === 0) return String(d.getHours() % 12 || 12);
      return null;
    }
    const prev = new Date(times[i - 1]);
    switch (range) {
      case '1D': return d.getHours() !== prev.getHours() ? String(d.getHours() % 12 || 12) : null;
      case '1W': return times[i] - times[i - 1] > 2 * HOUR ? String(d.getDate()) : null;
      case '1M': return d.getDay() < prev.getDay() || times[i] - times[i - 1] >= 7 * 24 * HOUR ? String(d.getDate()) : null;
      case '3M': case '6M': case '1Y': return d.getMonth() !== prev.getMonth() ? d.toLocaleDateString('en-US', {month: 'short'}) : null;
      default: return d.getFullYear() !== prev.getFullYear() ? String(d.getFullYear()) : null;
    }
  }

  // Where each hour (1D), session (1W), week (1M), month (3M–1Y) or year (All)
  // begins. When they crowd, every second or third is kept, evenly. A unit that
  // begins on the last point spans nothing, so it gets no guide.
  function timeAxis(times, xs, range, width, charW) {
    const ticks = [];
    for (let i = 0; i < times.length - 1; i++) { const label = unitStart(times, i, range); if (label) ticks.push({x: xs[i], label}); }
    const room = Math.max(0, ...ticks.map(t => t.label.length)) * charW + 2 * INSET;
    let every = 1;
    while (ticks.some((t, j) => j >= every && j % every === 0 && t.x - ticks[j - every].x < room)) every++;
    return ticks.filter((t, j) => j % every === 0 && t.x + INSET + t.label.length * charW <= width);
  }

  // Grey strokes rising from the strip's floor, scaled to the busiest bar.
  // Bars nearer than 3px are summed, so a long range reads as a texture.
  function volumePath(xs, vols, floor) {
    const bars = [];
    xs.forEach((x, i) => { const bar = bars[bars.length - 1]; if (bar && x - bar.x < 3) bar.v += vols[i]; else bars.push({x, v: vols[i]}); });
    const max = Math.max(...bars.map(b => b.v));
    if (!(max > 0)) return '';
    return bars.filter(b => b.v > 0).map(b => `M${b.x.toFixed(1)} ${floor}v-${Math.max(1, b.v / max * VOLUME_H).toFixed(1)}`).join('');
  }

  // The bar times the app's history API returns for a range ending at `end`:
  // 5-minute bars for 1D (today's session so far), 15-minute for 1W, hourly
  // for 1M, daily to 1Y and weekly for All (from `allStart`), on weekdays
  // from 9:30 to 16:00. Holidays are ignored; the data is illustrative.
  function tradingTimes(range, end, allStart) {
    end = new Date(end);
    const start = new Date(end), out = [];
    const minutes = {'1D': 5, '1W': 15, '1M': 60}[range];
    if (range === '1D') start.setHours(9, 30, 0, 0);
    else if (range === '1W') start.setDate(start.getDate() - 7);
    else if (range === '1M') start.setMonth(start.getMonth() - 1);
    else if (range === '3M') start.setMonth(start.getMonth() - 3);
    else if (range === '6M') start.setMonth(start.getMonth() - 6);
    else if (range === '1Y') start.setFullYear(start.getFullYear() - 1);
    else start.setTime(+new Date(allStart));
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    for (; day <= end; day.setDate(day.getDate() + 1)) {
      if (day.getDay() % 6 === 0) continue;
      if (!minutes) {
        if (range !== 'All' || day.getDay() === 1) { const t = new Date(day); t.setHours(9, 30); if (t >= start && t <= end) out.push(+t); }
        continue;
      }
      for (let m = 0; m < 390; m += minutes) { const t = new Date(day); t.setHours(9, 30 + m); if (t >= start && t <= end) out.push(+t); }
    }
    return out;
  }

  // Illustrative wander for a sample series: a seeded random walk pinned to
  // zero at both ends (a Brownian bridge), scaled so its widest swing is 1.
  function walk(n, seed) {
    let a = Math.imul(seed, 2654435761) >>> 0;
    const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const w = [0];
    for (let i = 1; i < n; i++) w.push(w[i - 1] + rand() - .5);
    const bridge = w.map((v, i) => v - w[n - 1] * (n > 1 ? i / (n - 1) : 1)), max = Math.max(...bridge.map(Math.abs)) || 1;
    return bridge.map(v => v / max);
  }

  // The chart's SVG and the geometry a study needs to scrub it. `fontScale` is
  // the study's type scale: the labels are JetBrains Mono at 10px × scale,
  // which advances 0.6em a character.
  function render({points, times, volumes, range, width, fontScale, fillId}) {
    const charW = 6 * fontScale, last = points.length - 1;
    const lo = Math.min(...points), hi = Math.max(...points), scale = valueAxis(lo, hi, charW);
    const plotW = width - scale.width, height = PLOT_H + AXIS_H + (volumes ? VOLUME_GAP + VOLUME_H : 0);
    const xs = points.map((_, i) => last ? i * plotW / last : 0), ys = points.map(v => plotY(v, lo, hi));
    const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const ticks = timeAxis(times, xs, range, width, charW);
    const label = (x, y, dy, text, end) => `<text class="chart-axis-label" x="${x}" y="${y}" dy="${dy}"${end ? ' text-anchor="end"' : ''}>${text}</text>`;
    const guides = scale.ticks.map(t => `M0 ${t.y}H${width}`).join('') + (scale.ticks.length ? `M${plotW} ${PLOT_TOP}V${PLOT_H}` : '');
    const volume = volumes ? volumePath(xs, volumes, height) : '';
    const svg = `<defs><linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity=".24"/><stop offset="100%" stop-color="var(--accent)" stop-opacity=".02"/></linearGradient></defs>`
      + `<g aria-hidden="true"><path d="${guides}" fill="none" stroke="var(--line)"/><path d="M0 ${PLOT_H - .5}H${width}" fill="none" stroke="var(--muted)"/>`
      + scale.ticks.map(t => label(width, t.y, '1.2em', t.label, true)).join('')
      + `<path d="${ticks.map(t => `M${Math.round(t.x) + .5} ${PLOT_TOP}V${PLOT_H + AXIS_H}`).join('')}" fill="none" stroke="var(--line)"/>`
      + ticks.map(t => label(t.x + INSET, PLOT_H + AXIS_H / 2, '.36em', t.label)).join('')
      + (volume ? `<path d="${volume}" fill="none" stroke="var(--muted)" stroke-width="1.5"/>` : '') + '</g>'
      + `<path d="${path} L${plotW},${PLOT_BOTTOM} L0,${PLOT_BOTTOM} Z" fill="url(#${fillId})"/>`
      + `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<circle cx="${xs[last]}" cy="${ys[last]}" r="3" fill="var(--accent)"/>`
      + `<g id="chart-cursor" visibility="hidden"><line y1="0" y2="${PLOT_H}" stroke="var(--muted)" stroke-dasharray="2 3"/><circle r="4" fill="var(--accent)" stroke="var(--bg)" stroke-width="2"/></g>`;
    return {svg, xs, ys, plotW, height};
  }

  window.pocChart = {render, tradingTimes, walk};
})();
