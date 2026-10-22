import { z } from "zod";
import { pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { users } from "@/domain/identity/identity.schema";

// The symbols a person keeps an eye on. It belongs to the user, not to a
// portfolio: switching portfolios doesn't change what you're watching.
export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // A Yahoo symbol, exchange suffix included (SHOP.TO), as the market API prices it.
    symbol: varchar({ length: 20 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.symbol)],
);

const WatchlistItemsSelectSchema = createSelectSchema(watchlistItems);
const WatchlistItemsInsertSchema = createInsertSchema(watchlistItems);

export type WatchlistItemsSelect = z.infer<typeof WatchlistItemsSelectSchema>;
export type WatchlistItemsInsert = z.infer<typeof WatchlistItemsInsertSchema>;
