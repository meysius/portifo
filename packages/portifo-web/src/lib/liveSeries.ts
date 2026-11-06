// A day's 5-minute bars, run on to the quote's latest trade: how the 1D chart
// and the watchlist's lines follow the price as it streams in.
import type { Quote } from "../api/market";
import type { Session } from "./chartAxis";

// A price at a time, epoch ms, and its session when it isn't the regular one.
export type LivePoint = { t: number; p: number; x?: Session };

// 1D's bars are five minutes apart, each stamped with its start.
export const DAY_BAR_MS = 5 * 60_000;
export const barStart = (t: number) => t - (t % DAY_BAR_MS);

// The quote's latest trade: its regular price, or with extended hours drawn,
// the trade outside the session that followed it.
export function latestTrade(quote: Quote, extended: boolean): LivePoint | null {
  const regular = quote.marketTime ? { t: Date.parse(quote.marketTime), p: quote.price } : null;
  const ext = extended ? quote.extended : undefined;
  if (ext && (!regular || Date.parse(ext.time) > regular.t)) {
    return { t: Date.parse(ext.time), p: ext.price, x: ext.session };
  }
  return regular;
}

// A day's bars with the latest trade at the end. Within the last bar's five
// minutes (the close, a second after 4 PM, falls in the 4 PM bar) it moves
// that bar; past them it is a bar of its own, until a refetch brings Yahoo's.
// Yahoo's chart has no overnight bars, so overnight it is the one point past
// the day's 8 PM close.
export function withLatest<P extends LivePoint>(s: P[], trade: P | null): P[] {
  const end = s[s.length - 1];
  if (!trade || !end || !(trade.t > end.t) || !(trade.p > 0)) return s;
  if (trade.t - barStart(end.t) <= DAY_BAR_MS) return [...s.slice(0, -1), { ...end, t: trade.t, p: trade.p, x: trade.x }];
  return [...s, trade];
}
