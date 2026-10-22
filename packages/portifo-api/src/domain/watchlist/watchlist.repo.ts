import { and, asc, eq } from "drizzle-orm";
import { DrizzleDb } from "@/setup/db";
import { watchlistItems, WatchlistItemsSelect } from "./watchlist.schema";

export interface WatchlistRepo {
  listByUser(userId: string): Promise<WatchlistItemsSelect[]>;
  add(userId: string, symbol: string): Promise<WatchlistItemsSelect>;
  remove(userId: string, symbol: string): Promise<void>;
}

export class DrizzleWatchlistRepo implements WatchlistRepo {
  constructor(private readonly db: DrizzleDb) {}

  // In the order they were added: a new symbol joins the bottom of the list.
  async listByUser(userId: string): Promise<WatchlistItemsSelect[]> {
    return this.db
      .select()
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, userId))
      .orderBy(asc(watchlistItems.createdAt));
  }

  // Adding a symbol that's already there keeps the original row (and its place).
  async add(userId: string, symbol: string): Promise<WatchlistItemsSelect> {
    const inserted = await this.db
      .insert(watchlistItems)
      .values({ userId, symbol })
      .onConflictDoNothing({ target: [watchlistItems.userId, watchlistItems.symbol] })
      .returning();
    if (inserted[0]) return inserted[0];
    const existing = await this.db
      .select()
      .from(watchlistItems)
      .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.symbol, symbol)));
    return existing[0];
  }

  async remove(userId: string, symbol: string): Promise<void> {
    await this.db
      .delete(watchlistItems)
      .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.symbol, symbol)));
  }
}
