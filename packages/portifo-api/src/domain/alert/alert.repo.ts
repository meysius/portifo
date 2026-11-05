import { and, asc, eq, exists, gt, gte, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { DrizzleDb } from "@/setup/db";
import { watchlistItems } from "@/domain/watchlist/watchlist.schema";
import { AlertDirection, AlertMode, priceAlerts, PriceAlertsInsert, PriceAlertsSelect, PriceSide } from "./alert.schema";

export type AlertChanges = { mode: AlertMode; direction: AlertDirection; price: string };

// A live rule that went off, the way the price went, and the level it crossed
// (the rule's new `anchor`).
export type LiveFiring = { alert: PriceAlertsSelect; crossed: PriceSide; level: number };

export interface AlertRepo {
  listByUser(userId: string): Promise<PriceAlertsSelect[]>;
  create(alert: PriceAlertsInsert): Promise<PriceAlertsSelect>;
  update(userId: string, id: string, changes: AlertChanges): Promise<PriceAlertsSelect | null>;
  remove(userId: string, id: string): Promise<boolean>;
  listRunningSymbols(): Promise<string[]>;
  fireCrossed(
    symbol: string,
    price: number,
    at: Date,
    onFired: (alerts: PriceAlertsSelect[]) => Promise<void>,
  ): Promise<void>;
  fireLive(symbol: string, price: number, at: Date, onFired: (fired: LiveFiring[]) => Promise<void>): Promise<void>;
  arm(symbol: string, price: number): Promise<void>;
}

// A "once" rule at its target, or past it, coming from the side it was armed on.
const crossed = (price: number) =>
  or(
    and(eq(priceAlerts.armedFrom, "above"), gte(priceAlerts.price, String(price))),
    and(eq(priceAlerts.armedFrom, "below"), lte(priceAlerts.price, String(price))),
  );

// On a side of a "once" rule's target it can cross from: above it for "below",
// below it for "above", either for "both". Exactly at the target is neither.
const crossable = (price: number) =>
  or(
    and(ne(priceAlerts.direction, "above"), lt(priceAlerts.price, String(price))),
    and(ne(priceAlerts.direction, "below"), gt(priceAlerts.price, String(price))),
  );

// A live rule's levels are the multiples of its step, `price`. For each way the
// price can go: whether it has reached the next level past the rule's anchor,
// and the furthest level it crossed getting there, which becomes the anchor.
// In numeric, so a $0.10 step lands on 190.30 and not 190.29999999.
const LIVE = {
  below: {
    reached: (p: SQL) => sql`${p} <= (ceil(${priceAlerts.anchor} / ${priceAlerts.price}) - 1) * ${priceAlerts.price}`,
    level: (p: SQL) => sql`ceil(${p} / ${priceAlerts.price}) * ${priceAlerts.price}`,
  },
  above: {
    reached: (p: SQL) => sql`${p} >= (floor(${priceAlerts.anchor} / ${priceAlerts.price}) + 1) * ${priceAlerts.price}`,
    level: (p: SQL) => sql`floor(${p} / ${priceAlerts.price}) * ${priceAlerts.price}`,
  },
} satisfies Record<PriceSide, unknown>;

export class DrizzleAlertRepo implements AlertRepo {
  constructor(private readonly db: DrizzleDb) {}

  // Live, or a "once" rule not yet fired, on a symbol its owner still watches.
  private running() {
    return and(
      or(eq(priceAlerts.mode, "live"), isNull(priceAlerts.triggeredAt)),
      exists(
        this.db
          .select({ id: watchlistItems.id })
          .from(watchlistItems)
          .where(and(eq(watchlistItems.userId, priceAlerts.userId), eq(watchlistItems.symbol, priceAlerts.symbol))),
      ),
    );
  }

  async listByUser(userId: string): Promise<PriceAlertsSelect[]> {
    return this.db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, userId))
      .orderBy(asc(priceAlerts.createdAt));
  }

  async create(alert: PriceAlertsInsert): Promise<PriceAlertsSelect> {
    const inserted = await this.db.insert(priceAlerts).values(alert).returning();
    return inserted[0];
  }

  // Any save starts the rule over: it's disarmed, so the next check decides
  // again which side of the new price the market is on, and a rule that had
  // fired is on again.
  async update(userId: string, id: string, changes: AlertChanges): Promise<PriceAlertsSelect | null> {
    const updated = await this.db
      .update(priceAlerts)
      .set({ ...changes, armedFrom: null, anchor: null, triggeredAt: null, triggeredPrice: null })
      .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.id, id)))
      .returning();
    return updated[0] ?? null;
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const removed = await this.db
      .delete(priceAlerts)
      .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.id, id)))
      .returning({ id: priceAlerts.id });
    return removed.length > 0;
  }

  async listRunningSymbols(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ symbol: priceAlerts.symbol })
      .from(priceAlerts)
      .where(this.running());
    return rows.map((r) => r.symbol);
  }

  // Decided and recorded in one statement, so a rule can't fire twice, and an
  // edit landing mid-check (which disarms it) can't be fired on its old price.
  // It commits only once `onFired` is done: if that throws, or the process dies
  // first, the rules stay armed and the next check fires them again, so a rule
  // can't end up fired with its notification lost.
  async fireCrossed(
    symbol: string,
    price: number,
    at: Date,
    onFired: (alerts: PriceAlertsSelect[]) => Promise<void>,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const fired = await tx
        .update(priceAlerts)
        .set({ triggeredAt: at, triggeredPrice: String(price) })
        .where(and(this.running(), eq(priceAlerts.symbol, symbol), eq(priceAlerts.mode, "once"), crossed(price)))
        .returning();
      if (fired.length > 0) await onFired(fired);
    });
  }

  // Moves each live rule whose next level the price has reached on to the
  // furthest level it crossed, and fires the ones watching that way: several
  // levels in one check make one notification, not one each. A rule watching
  // the other way only follows the price, so its next alert counts from where
  // the price has got to. Atomic and committed after `onFired`, as above.
  async fireLive(
    symbol: string,
    price: number,
    at: Date,
    onFired: (fired: LiveFiring[]) => Promise<void>,
  ): Promise<void> {
    const p = sql`${String(price)}::numeric`;
    await this.db.transaction(async (tx) => {
      const fired: LiveFiring[] = [];
      for (const side of ["below", "above"] as const) {
        const { reached, level } = LIVE[side];
        const moved = and(
          this.running(),
          eq(priceAlerts.symbol, symbol),
          eq(priceAlerts.mode, "live"),
          isNotNull(priceAlerts.anchor),
          reached(p),
        );
        const otherWay = side === "below" ? "above" : "below";
        await tx
          .update(priceAlerts)
          .set({ anchor: level(p) })
          .where(and(moved, eq(priceAlerts.direction, otherWay)));
        const rows = await tx
          .update(priceAlerts)
          .set({ anchor: level(p), triggeredAt: at, triggeredPrice: String(price) })
          .where(and(moved, ne(priceAlerts.direction, otherWay)))
          .returning();
        fired.push(...rows.map((alert) => ({ alert, crossed: side, level: Number(alert.anchor) })));
      }
      if (fired.length > 0) await onFired(fired);
    });
  }

  // A "once" rule not yet armed records which side of its target the market
  // is on, if it could cross from there. A "both" rule takes whichever side it
  // finds; one at its target exactly waits for the market to move off it.
  // A new live rule starts from the current price.
  async arm(symbol: string, price: number): Promise<void> {
    await this.db
      .update(priceAlerts)
      .set({
        armedFrom: sql`(case when ${priceAlerts.price} < ${String(price)} then 'above' else 'below' end)::price_side`,
      })
      .where(
        and(
          this.running(),
          eq(priceAlerts.symbol, symbol),
          eq(priceAlerts.mode, "once"),
          isNull(priceAlerts.armedFrom),
          crossable(price),
        ),
      );
    await this.db
      .update(priceAlerts)
      .set({ anchor: String(price) })
      .where(
        and(this.running(), eq(priceAlerts.symbol, symbol), eq(priceAlerts.mode, "live"), isNull(priceAlerts.anchor)),
      );
  }
}
