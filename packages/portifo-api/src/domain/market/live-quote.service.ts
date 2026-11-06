import { SWLogger } from "simple-wire";
import { ExtendedHours, MarketService, Quote, QuoteSnapshot } from "./market.service";
import { Tick } from "./pricing-data";
import { YahooStreamer } from "./yahoo-streamer";

export type QuoteListener = (quote: Quote) => void;

// A standing interest in some symbols' quotes: each one as soon as it's held,
// then again whenever it moves.
export interface QuoteWatch {
  set(symbols: string[]): void;
  close(): void;
}

// Each symbol's quote, kept within about half a minute of the market for as
// long as anyone watches it. Two feeds race, and the newer trade wins:
//
// - Yahoo's streamer, which pushes trades as they print: within a second on a
//   good day, though it has been seen running a minute behind, and some
//   symbols (^GSPC) never stream at all;
// - Yahoo's quote endpoint, asked every 30 seconds for a symbol whose market
//   is open and every five minutes otherwise, in one request for all of them.
//   It's also what fills in everything a trade doesn't carry: the previous
//   close, the day's volume, the market's state.
//
// One connection and one poll serve every watcher, however many there are.
export class LiveQuoteService {
  private readonly entries = new Map<string, Entry>();
  private readonly watchers = new Set<Watcher>();
  private poller: NodeJS.Timeout | null = null;
  private polling = false;
  private backoffUntil = 0;
  private failures = 0;

  constructor(
    private readonly logger: SWLogger,
    private readonly marketService: MarketService,
    private readonly streamer: YahooStreamer,
  ) {
    streamer.onTick = (tick) => this.receive(tick);
  }

  watch(symbols: string[], listener: QuoteListener): QuoteWatch {
    const watcher: Watcher = { symbols: new Set(), listener };
    this.watchers.add(watcher);
    const set = (wanted: string[]) => {
      if (!this.watchers.has(watcher)) return;
      const next = new Set(wanted);
      const added = [...next].filter((s) => !watcher.symbols.has(s));
      const removed = [...watcher.symbols].filter((s) => !next.has(s));
      watcher.symbols = next;
      for (const symbol of added) this.retain(symbol);
      for (const symbol of removed) this.release(symbol);
      this.updateStream();
      // What's already held goes out at once; the rest as the poll brings it.
      const held = added.map((s) => this.entries.get(s)?.quote).filter((q): q is Quote => q != null);
      if (held.length) setImmediate(() => held.forEach((q) => this.watchers.has(watcher) && listener(q)));
      if (added.some((s) => this.entries.get(s)?.due)) this.pollSoon();
    };
    set(symbols);
    return {
      set,
      close: () => {
        if (!this.watchers.delete(watcher)) return;
        for (const symbol of watcher.symbols) this.release(symbol);
      },
    };
  }

  // The quote as it stands, if the symbol is watched and has been polled.
  latest(symbol: string): Quote | null {
    return this.entries.get(symbol)?.quote ?? null;
  }

  stop(): void {
    if (this.poller) clearInterval(this.poller);
    this.poller = null;
    this.streamer.stop();
  }

  private retain(symbol: string): void {
    const entry = this.entries.get(symbol);
    if (entry) {
      entry.refs += 1;
      entry.idleSince = null;
      return;
    }
    this.entries.set(symbol, { refs: 1, idleSince: null, quote: null, extendedHours: null, polledAt: 0, due: true });
    this.startPolling();
  }

  // Kept a minute after its last watcher goes, so an app reconnecting to
  // change what it watches finds it still warm.
  private release(symbol: string): void {
    const entry = this.entries.get(symbol);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) entry.idleSince = Date.now();
  }

  private updateStream(): void {
    this.streamer.track(this.entries.keys());
  }

  private startPolling(): void {
    if (this.poller) return;
    this.poller = setInterval(() => void this.poll(), POLL_WAKE_MS);
    this.poller.unref();
  }

  private pollSoon(): void {
    setTimeout(() => void this.poll(), 50).unref();
  }

  private async poll(): Promise<void> {
    const now = Date.now();
    this.dropIdle(now);
    if (this.polling || now < this.backoffUntil) return;
    const wanted = [...this.entries].filter(([, e]) => e.due || now - e.polledAt >= refreshEvery(e)).map(([s]) => s);
    if (wanted.length === 0) return;

    this.polling = true;
    try {
      for (let i = 0; i < wanted.length; i += POLL_BATCH) {
        const batch = wanted.slice(i, i + POLL_BATCH);
        const snapshots = await this.marketService.getQuoteSnapshots(batch);
        for (const symbol of batch) {
          const entry = this.entries.get(symbol);
          if (!entry) continue;
          entry.polledAt = now;
          entry.due = false;
        }
        for (const snapshot of snapshots) this.merge(snapshot);
      }
      this.failures = 0;
    } catch (err) {
      // 30s, 1m, 2m… up to 5m. The stream carries on meanwhile.
      this.failures += 1;
      const wait = Math.min(300_000, 30_000 * 2 ** (this.failures - 1));
      this.backoffUntil = now + wait;
      this.logger.error(`Live prices: polling failed, next try in ${wait / 1000}s: ${(err as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  private dropIdle(now: number): void {
    let dropped = false;
    for (const [symbol, entry] of this.entries) {
      if (entry.refs <= 0 && entry.idleSince != null && now - entry.idleSince >= IDLE_KEEP_MS) {
        this.entries.delete(symbol);
        dropped = true;
      }
    }
    if (!dropped) return;
    this.updateStream();
    if (this.entries.size === 0 && this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
  }

  private merge({ quote: snap, extendedHours }: QuoteSnapshot): void {
    const entry = this.entries.get(snap.symbol);
    if (!entry) return;
    entry.extendedHours = extendedHours;
    const held = entry.quote;
    let next: Quote;
    if (!held || time(snap.marketTime) >= time(held.marketTime)) {
      next = snap;
    } else if (time(held.marketTime) - time(snap.marketTime) <= SESSION_GAP_MS) {
      // The stream is ahead of the poll within the same session: its price
      // stands, and the poll brings the rest (volume, the market's state).
      next = {
        ...snap,
        price: held.price,
        marketTime: held.marketTime,
        dayHigh: Math.max(snap.dayHigh, held.dayHigh),
        dayLow: lowest(snap.dayLow, held.dayLow),
        ...moveFrom(moveBase(snap), held.price),
      };
    } else {
      // The poll is from a session the stream has already left behind.
      next = held;
    }
    this.publish(entry, withExtended(next, newer(held?.extended, snap.extended)));
  }

  private receive(tick: Tick): void {
    const entry = this.entries.get(tick.symbol);
    const held = entry?.quote;
    // Before the first poll there's no quote to fold a trade into: no
    // currency, no previous close. It's due, so that's moments away.
    if (!entry || !held) return;
    const heldTime = time(held.marketTime);
    const session = sessionOf(tick, entry.extendedHours);
    if (session == null) return;

    if (session === "regular") {
      if (tick.time < heldTime || (tick.time === heldTime && tick.price === held.price)) return;
      let next: Quote;
      if (held.marketState !== "REGULAR" && tick.time - heldTime > SESSION_GAP_MS) {
        // A new session has opened: the price held until now was the close
        // before it. A poll brings the rest of the new day at once.
        entry.due = true;
        this.pollSoon();
        next = {
          ...held,
          price: tick.price,
          marketTime: new Date(tick.time).toISOString(),
          marketState: "REGULAR",
          open: tick.price,
          dayHigh: tick.price,
          dayLow: tick.price,
          volume: 0,
          ...moveFrom(held.price, tick.price),
          previousClose: held.price,
        };
      } else {
        next = {
          ...held,
          price: tick.price,
          marketTime: new Date(tick.time).toISOString(),
          dayHigh: held.dayHigh > 0 ? Math.max(held.dayHigh, tick.price) : tick.price,
          dayLow: lowest(held.dayLow, tick.price),
          ...moveFrom(moveBase(held), tick.price),
        };
      }
      this.publish(entry, withExtended(next, held.extended));
      return;
    }

    if (tick.time <= heldTime || (held.extended && tick.time <= time(held.extended.time))) return;
    // Yahoo has no market state for overnight; the quote keeps the one it has.
    const marketState = session === "pre" ? "PRE" : session === "post" ? "POST" : held.marketState;
    const next: Quote = { ...held, marketState };
    this.publish(entry, withExtended(next, { session, price: tick.price, time: new Date(tick.time).toISOString() }));
  }

  private publish(entry: Entry, quote: Quote): void {
    if (entry.quote && sameQuote(entry.quote, quote)) return;
    entry.quote = quote;
    for (const watcher of this.watchers) {
      if (!watcher.symbols.has(quote.symbol)) continue;
      try {
        watcher.listener(quote);
      } catch (err) {
        this.logger.error(`Live prices: a watcher failed: ${(err as Error).message}`);
      }
    }
  }
}

type Entry = {
  // Watchers holding it, and since when it has had none.
  refs: number;
  idleSince: number | null;
  quote: Quote | null;
  // Whether the listing trades pre-market and after hours; null until polled.
  extendedHours: boolean | null;
  polledAt: number;
  // To be polled on the next wake whatever its pace: new, or a new session.
  due: boolean;
};

type Watcher = { symbols: Set<string>; listener: QuoteListener };

const POLL_WAKE_MS = 5_000;
// Yahoo's quote endpoint takes many symbols at once; this keeps the URL short.
const POLL_BATCH = 50;
const TRADING_REFRESH_MS = 30_000;
const IDLE_REFRESH_MS = 300_000;
const IDLE_KEEP_MS = 60_000;
// Longer than any pause within a session (Tokyo's lunch is an hour), shorter
// than any night.
const SESSION_GAP_MS = 2 * 3_600_000;

const TRADING_STATES = new Set(["REGULAR", "PRE", "POST"]);

function refreshEvery(entry: Entry): number {
  return entry.quote?.marketState && TRADING_STATES.has(entry.quote.marketState) ? TRADING_REFRESH_MS : IDLE_REFRESH_MS;
}

// Which session a trade falls in, by the feed's own flag: 0 pre-market, 1
// regular, 2 post-market, 3 extended, 4 overnight. A listing that doesn't
// trade outside the regular session gets only regular trades, whatever the
// flag says. A flag this doesn't know is dropped rather than guessed at: the
// poll still brings the price.
function sessionOf(tick: Tick, extendedHours: boolean | null): "regular" | ExtendedHours["session"] | null {
  if (extendedHours === false) return "regular";
  switch (tick.marketHours) {
    case 0:
      return "pre";
    case 1:
      return "regular";
    case 2:
    case 3:
      return "post";
    case 4:
      return "overnight";
    default:
      return null;
  }
}

function time(iso: string | undefined): number {
  return iso ? new Date(iso).getTime() : 0;
}

function lowest(a: number, b: number): number {
  return a > 0 && b > 0 ? Math.min(a, b) : a > 0 ? a : b;
}

// What a quote's move for the day is measured from: the previous close for
// most, but for crypto a 24-hour reference of Yahoo's own, which only the
// change it quotes gives away. A quote with no change at all has only the
// previous close to go on.
function moveBase(q: Quote): number {
  return q.change === 0 && q.previousClose ? q.previousClose : q.price - q.change;
}

// The day's move to `price` from `base`.
function moveFrom(base: number, price: number): Pick<Quote, "change" | "changePercent"> {
  const change = price - base;
  return { change, changePercent: base > 0 ? (change / base) * 100 : 0 };
}

type ExtendedTrade = { session: ExtendedHours["session"]; price: number; time: string };

function newer(a: ExtendedTrade | undefined, b: ExtendedTrade | undefined): ExtendedTrade | undefined {
  if (!a) return b;
  if (!b) return a;
  return time(b.time) >= time(a.time) ? b : a;
}

// Sets the trade outside the regular session, measured from the regular
// price, while it's the latest; a regular trade since makes it history.
function withExtended(quote: Quote, trade: ExtendedTrade | undefined): Quote {
  if (!trade || time(trade.time) <= time(quote.marketTime) || quote.marketState === "REGULAR") {
    return { ...quote, extended: undefined };
  }
  const change = trade.price - quote.price;
  return {
    ...quote,
    extended: {
      session: trade.session,
      price: trade.price,
      change,
      changePercent: quote.price > 0 ? (change / quote.price) * 100 : 0,
      time: trade.time,
    },
  };
}

function sameQuote(a: Quote, b: Quote): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
