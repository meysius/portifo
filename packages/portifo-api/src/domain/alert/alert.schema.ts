import { z } from "zod";
import { boolean, numeric, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { users } from "@/domain/identity/identity.schema";

export const alertDirectionEnum = pgEnum("alert_direction", ["below", "above"]);

// "Tell me when this symbol crosses below (or above) this price." A rule fires
// once and then stays on the list as a record of when it went off; saving it
// again turns it back on. It belongs to the user, like the watchlist, and only
// runs while its symbol is on that user's watchlist.
export const priceAlerts = pgTable("price_alerts", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // A Yahoo symbol, exchange suffix included (SHOP.TO), as the market API prices it.
  symbol: varchar({ length: 20 }).notNull(),
  direction: alertDirectionEnum().notNull(),
  // Per share, in the symbol's own currency.
  price: numeric({ precision: 20, scale: 8 }).notNull(),
  // Whether the price has been seen on the starting side of `price`. Only then
  // can it cross: a rule set below a price that's already lower waits for the
  // price to come back up first, rather than firing on the next check.
  armed: boolean().notNull().default(false),
  triggeredAt: timestamp(),
  // The price that set it off.
  triggeredPrice: numeric({ precision: 20, scale: 8 }),
  createdAt: timestamp().notNull().defaultNow(),
});

const PriceAlertsSelectSchema = createSelectSchema(priceAlerts);
const PriceAlertsInsertSchema = createInsertSchema(priceAlerts);

export type PriceAlertsSelect = z.infer<typeof PriceAlertsSelectSchema>;
export type PriceAlertsInsert = z.infer<typeof PriceAlertsInsertSchema>;
export type AlertDirection = PriceAlertsSelect["direction"];
