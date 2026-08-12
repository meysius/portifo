// Why does the Portfolio hero disagree with the value chart?
//
// The two figures are computed by completely different paths — the hero from
// stored balances plus live quotes (client-side), the chart by replaying the
// ledger against historical prices/fx (server-side) — so this reproduces BOTH
// from the same API and prints the pieces side by side until the gap has a
// name.
//
// Reads nothing but the API, so it needs no database credentials:
//
//   BASE_URL=https://your-app COOKIE='portifo_session=...' \
//     node packages/portifo-api/scripts/diagnose-chart-gap.mjs
//
// Get COOKIE from a logged-in browser: DevTools > Application > Cookies, copy
// the portifo_session value. If you use several portfolios, pass the one you
// are looking at as PORTFOLIO_ID (the app sends it as the X-Portfolio-Id
// header; without it the server falls back to your first portfolio, which is a
// gap worth ruling out on its own).

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const COOKIE = process.env.COOKIE ?? "";
const PORTFOLIO_ID = process.env.PORTFOLIO_ID ?? "";
const RANGE = process.env.RANGE ?? "1M";
const CURRENCY = (process.env.CURRENCY ?? "USD").toUpperCase();

if (!COOKIE) {
  console.error("Set COOKIE='portifo_session=...' (copy it from a logged-in browser).");
  process.exit(1);
}

const headers = {
  Cookie: COOKIE.includes("=") ? COOKIE : `portifo_session=${COOKIE}`,
  ...(PORTFOLIO_ID ? { "X-Portfolio-Id": PORTFOLIO_ID } : {}),
};

const api = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
};

const money = (n) => (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (s, n) => String(s).padStart(n);

// Same convention as the web app's lib/fx.ts: rates are "1 USD = N units".
const toDisplay = (amount, from, rates) => {
  if (from === CURRENCY) return amount;
  const usd = from === "USD" ? amount : amount / (rates[from] ?? 1);
  return CURRENCY === "USD" ? usd : usd * (rates[CURRENCY] ?? 1);
};

const portfolios = await api("/portfolios");
console.log(`portfolios: ${portfolios.map((p) => `${p.name} (${p.id})`).join(", ")}`);
console.log(`reading:    ${PORTFOLIO_ID || "server default = first portfolio"}  range=${RANGE}  currency=${CURRENCY}\n`);

const accounts = await api("/accounts");
const transactions = await api("/transactions");

// ── cash the hero adds up: the stored balance on every account.
// NOTE: the chart's own cash figure cannot be reproduced from /transactions,
// which deliberately hides the system-generated rows balance edits create on
// cash accounts. It is recovered further down by subtracting the valued
// holdings from the chart's last point instead.
const stored = {};
for (const a of accounts) for (const b of a.balances ?? a.currencyBalances ?? []) stored[b.currency] = (stored[b.currency] ?? 0) + Number(b.balance);

// ── holdings, from the same replay the chart does
const shares = {};
for (const t of transactions) {
  const sym = t.symbol ?? t.ticker;
  if (sym) shares[sym] = (shares[sym] ?? 0) + Number(t.shares) * (t.type === "sell" ? -1 : 1);
}
const open = Object.entries(shares).filter(([, s]) => Math.abs(s) > 1e-9);

const quotes = open.length ? await api(`/market/quotes?symbols=${open.map(([s]) => s).join(",")}`) : [];
const qmap = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
const ccys = [...new Set([...Object.keys(stored), ...quotes.map((q) => q.currency)])].filter((c) => c !== "USD");
const fx = ccys.length ? await api(`/market/fx?base=USD&symbols=${ccys.join(",")}`) : { rates: { USD: 1 } };

console.log("CASH — stored balances, per account (what the hero adds up)");
let storedCash = 0;
for (const cur of Object.keys(stored).sort()) {
  storedCash += toDisplay(stored[cur], cur, fx.rates);
  console.log(`  ${cur}  ${pad(money(stored[cur]), 16)}  ->  ${CURRENCY} ${pad(money(toDisplay(stored[cur], cur, fx.rates)), 14)}`);
}
console.log(`  total in ${CURRENCY}: ${money(storedCash)}\n`);

console.log("HOLDINGS — priced by the hero vs priced by the chart");
let live = 0;
let atClose = 0;
for (const [sym, sh] of open) {
  const q = qmap[sym];
  let hist = [];
  try {
    hist = await api(`/market/history?symbol=${encodeURIComponent(sym)}&range=${RANGE}`);
  } catch {
    hist = [];
  }
  const last = hist.length ? hist[hist.length - 1] : null;
  const liveVal = q ? toDisplay(sh * q.price, q.currency, fx.rates) : 0;
  const closeVal = last && q ? toDisplay(sh * last.close, q.currency, fx.rates) : 0;
  live += liveVal;
  atClose += closeVal;
  const notes = [];
  if (!q) notes.push("NO QUOTE (missing from the hero)");
  if (!last) notes.push("NO PRICE HISTORY (estimated on the chart)");
  console.log(`  ${sym.padEnd(8)} ${pad(sh, 10)} sh   live ${pad(money(liveVal), 14)}   lastClose ${pad(money(closeVal), 14)}   ${notes.join(", ")}`);
}
console.log(`  positions: live ${money(live)}   atLastClose ${money(atClose)}\n`);

const history = await api(`/portfolio/history?range=${RANGE}&currency=${CURRENCY}`);
// Tolerates both shapes: the old bare array and the current envelope.
const points = Array.isArray(history) ? history : history.points;
const estTickers = Array.isArray(history) ? null : history.estimatedTickers;
const estCurrencies = Array.isArray(history) ? null : history.estimatedCurrencies;

const hero = storedCash + live;
const chartLast = points?.length ? points[points.length - 1].close : NaN;

console.log("TOTALS");
console.log(`  hero  (stored cash + live quotes)  ${pad(money(hero), 16)}`);
console.log(`  chart (ledger replay, last point)  ${pad(money(chartLast), 16)}   @ ${points?.[points.length - 1]?.date}`);
console.log(`  gap                                ${pad(money(hero - chartLast), 16)}\n`);

// The chart's own cash, recovered by subtracting the holdings it valued (at
// the same closes it used) from its last point. This is the only way to see
// the replay's cash from outside, and the number that matters: if it is short
// of the stored balances, that cash never became a transaction and no range of
// the chart will ever show it.
const chartCash = chartLast - atClose;
console.log("WHERE THE GAP IS");
console.log(`  cash:      hero ${pad(money(storedCash), 14)}   chart ${pad(money(chartCash), 14)}   diff ${pad(money(storedCash - chartCash), 14)}`);
console.log(`  holdings:  hero ${pad(money(live), 14)}   chart ${pad(money(atClose), 14)}   diff ${pad(money(live - atClose), 14)}   (live quote vs last close — expected intraday)`);
console.log();
if (Math.abs(storedCash - chartCash) > Math.max(50, Math.abs(hero) * 0.002)) {
  console.log("  >> The CASH figures disagree. Cash sitting in currency_balances that never");
  console.log("     became a ledger transaction is invisible to the replay — most likely a");
  console.log("     balance set before setCashAccountBalance began writing its balancing");
  console.log("     deposit/withdraw, or one written straight to the database.");
}
if (Math.abs(live - atClose) > Math.max(50, Math.abs(hero) * 0.002)) {
  console.log("  >> The HOLDINGS figures disagree by more than an intraday move. Check the");
  console.log("     per-holding table above for a symbol with no quote or no price history.");
}


if (estTickers === null) {
  console.log("NOTE: the server returned a bare array, so it is running a build from BEFORE the");
  console.log("      estimated-tickers fix. Deploy the current main and re-run before reading");
  console.log("      too much into the numbers above.");
} else {
  console.log(`server reported estimatedTickers=${JSON.stringify(estTickers)} estimatedCurrencies=${JSON.stringify(estCurrencies)}`);
}
