import { and, asc, eq, exists, gte, isNull, lte, not, or } from "drizzle-orm";
import { DrizzleDb } from "@/setup/db";
import { watchlistItems } from "@/domain/watchlist/watchlist.schema";
import { AlertDirection, priceAlerts, PriceAlertsInsert, PriceAlertsSelect } from "./alert.schema";

export type AlertChanges = { direction: AlertDirection; price: string };

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
  armApproaching(symbol: string, price: number): Promise<void>;
}

// At the target, or past it in the direction the rule is watching for.
const reached = (price: number) =>
  or(
    and(eq(priceAlerts.direction, "below"), gte(priceAlerts.price, String(price))),
    and(eq(priceAlerts.direction, "above"), lte(priceAlerts.price, String(price))),
  );

export class DrizzleAlertRepo implements AlertRepo {
  constructor(private readonly db: DrizzleDb) {}

  // Not yet fired, on a symbol its owner still watches.
  private running() {
    return and(
      isNull(priceAlerts.triggeredAt),
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
      .set({ ...changes, armed: false, triggeredAt: null, triggeredPrice: null })
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
        .where(and(this.running(), eq(priceAlerts.symbol, symbol), eq(priceAlerts.armed, true), reached(price)))
        .returning();
      if (fired.length > 0) await onFired(fired);
    });
  }

  async armApproaching(symbol: string, price: number): Promise<void> {
    await this.db
      .update(priceAlerts)
      .set({ armed: true })
      .where(and(this.running(), eq(priceAlerts.symbol, symbol), eq(priceAlerts.armed, false), not(reached(price)!)));
  }
}
