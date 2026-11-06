import WebSocket from "ws";
import { SWLogger } from "simple-wire";
import { decodeFrame, Tick } from "./pricing-data";

// Yahoo's live price feed: the WebSocket finance.yahoo.com itself listens
// on. Subscribe to symbols and it pushes each trade as it prints, several
// times a second for a busy listing. Listings that aren't trading send
// nothing, and some never stream at all (^GSPC), so the feed is half the
// story: LiveQuoteService polls alongside it.
const URL = "wss://streamer.finance.yahoo.com/?version=2";

// How often to ping, and how long the line may stay silent (no pong, no
// frame) before it counts as dead. A quiet market sends no frames for hours,
// so pings are what tell a dead line from a quiet one.
const PING_EVERY_MS = 15_000;
const DEAD_AFTER_MS = 40_000;
const HANDSHAKE_TIMEOUT_MS = 15_000;
const MAX_BACKOFF_MS = 30_000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  Origin: "https://finance.yahoo.com",
};

export class YahooStreamer {
  onTick: (tick: Tick) => void = () => {};

  private symbols = new Set<string>();
  // What the open connection has been told to send.
  private subscribed = new Set<string>();
  private socket: WebSocket | null = null;
  // Bumped whenever a connection is dropped, so its handlers can tell
  // they're stale.
  private generation = 0;
  private failures = 0;
  private lastHeard = 0;
  private retry: NodeJS.Timeout | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(private readonly logger: SWLogger) {}

  // Streams exactly `wanted`, connecting if need be, hanging up if it's empty.
  track(wanted: Iterable<string>): void {
    this.symbols = new Set(wanted);
    if (this.symbols.size === 0) {
      if (this.socket || this.retry) this.logger.info("Live prices: nothing to stream, disconnecting");
      this.teardown();
    } else if (!this.socket && !this.retry) {
      this.connect();
    } else {
      this.sync();
    }
  }

  stop(): void {
    this.stopped = true;
    this.teardown();
  }

  private connect(): void {
    this.teardown();
    if (this.stopped || this.symbols.size === 0) return;
    const generation = this.generation;
    const socket = new WebSocket(URL, { headers: HEADERS, handshakeTimeout: HANDSHAKE_TIMEOUT_MS });
    this.socket = socket;

    socket.on("open", () => {
      if (generation !== this.generation) return;
      this.logger.info(`Live prices: connected, streaming ${this.symbols.size} symbols`);
      this.lastHeard = Date.now();
      this.subscribed = new Set();
      this.sync();
      this.startHeartbeat(socket, generation);
    });
    socket.on("message", (data) => {
      if (generation !== this.generation) return;
      this.lastHeard = Date.now();
      this.failures = 0;
      const tick = decodeFrame(data.toString());
      if (tick) this.onTick(tick);
    });
    socket.on("pong", () => {
      if (generation !== this.generation) return;
      this.lastHeard = Date.now();
      this.failures = 0;
    });
    // A close always follows, and that's where it reconnects.
    socket.on("error", (err) => {
      if (generation === this.generation) this.logger.error(`Live prices: ${err.message}`);
    });
    socket.on("close", () => {
      if (generation === this.generation) this.scheduleRetry();
    });
  }

  // Brings the open connection's subscriptions in line with `symbols`.
  private sync(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const added = [...this.symbols].filter((s) => !this.subscribed.has(s)).sort();
    const removed = [...this.subscribed].filter((s) => !this.symbols.has(s)).sort();
    this.subscribed = new Set(this.symbols);
    // A failed send closes the socket, which reconnects.
    const ignore = () => {};
    if (added.length) socket.send(JSON.stringify({ subscribe: added }), ignore);
    if (removed.length) socket.send(JSON.stringify({ unsubscribe: removed }), ignore);
  }

  private startHeartbeat(socket: WebSocket, generation: number): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (generation !== this.generation) return;
      if (Date.now() - this.lastHeard > DEAD_AFTER_MS) {
        this.logger.error("Live prices: the line went silent");
        this.scheduleRetry();
        return;
      }
      socket.ping();
    }, PING_EVERY_MS);
    this.heartbeat.unref();
  }

  // 1s, 2s, 4s… up to 30s, jittered. Any frame or pong resets it.
  private scheduleRetry(): void {
    this.teardown();
    if (this.stopped || this.symbols.size === 0) return;
    this.failures += 1;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (this.failures - 1)) * (0.8 + Math.random() * 0.4);
    this.logger.info(`Live prices: reconnecting in ${Math.round(delay / 1000)}s`);
    this.retry = setTimeout(() => {
      this.retry = null;
      this.connect();
    }, delay);
    this.retry.unref();
  }

  private teardown(): void {
    this.generation += 1;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.socket?.terminate();
    this.socket = null;
    this.subscribed = new Set();
  }
}
