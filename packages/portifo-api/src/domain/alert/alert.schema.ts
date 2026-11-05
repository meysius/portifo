import { z } from "zod";
import { numeric, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { users } from "@/domain/identity/identity.schema";

export const alertDirectionEnum = pgEnum("alert_direction", ["below", "above", "both"]);
// Which side of a rule's price the market was on.
export const priceSideEnum = pgEnum("price_side", ["below", "above"]);
// "once": go off when the price crosses a target, then stop. "live": go off
// each time it crosses another multiple of a step ($2: ..., 190, 192, 194, ...).
export const alertModeEnum = pgEnum("alert_mode", ["once", "live"]);

// "Tell me when this symbol crosses below (or above, or either way) this
// price." A "once" rule fires once and then stays on the list as a record of
// when it went off; saving it again turns it back on. A "live" rule keeps
// going. A rule belongs to the user, like the watchlist, and only runs while
// its symbol is on that user's watchlist.
export const priceAlerts = pgTable("price_alerts", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // A Yahoo symbol, exchange suffix included (SHOP.TO), as the market API prices it.
  symbol: varchar({ length: 20 }).notNull(),
  mode: alertModeEnum().notNull().default("once"),
  direction: alertDirectionEnum().notNull().default("both"),
  // Per share, in the symbol's own currency: the target of a "once" rule, the
  // step of a "live" one.
  price: numeric({ precision: 20, scale: 8 }).notNull(),
  // The side of `price` the market was first seen on, if it's a side the rule
  // can cross from: above for "below", below for "above", either for "both".
  // Only once it's set can the rule fire: a rule set below a price that's
  // already lower waits for the price to come back up first, rather than
  // firing on the next check. Null until then.
  armedFrom: priceSideEnum(),
  // A live rule's reference point: the price when it started watching, then
  // the last level it crossed. It goes off at the next level either side, so a
  // price hovering on a level can't set it off again and again. Null until the
  // first check.
  anchor: numeric({ precision: 20, scale: 8 }),
  // When it went off, and the price that set it off: the end of a "once" rule,
  // the latest time for a "live" one.
  triggeredAt: timestamp(),
  triggeredPrice: numeric({ precision: 20, scale: 8 }),
  createdAt: timestamp().notNull().defaultNow(),
});

const PriceAlertsSelectSchema = createSelectSchema(priceAlerts);
const PriceAlertsInsertSchema = createInsertSchema(priceAlerts);

export type PriceAlertsSelect = z.infer<typeof PriceAlertsSelectSchema>;
export type PriceAlertsInsert = z.infer<typeof PriceAlertsInsertSchema>;
export type AlertDirection = PriceAlertsSelect["direction"];
export type AlertMode = PriceAlertsSelect["mode"];
export type PriceSide = NonNullable<PriceAlertsSelect["armedFrom"]>;
