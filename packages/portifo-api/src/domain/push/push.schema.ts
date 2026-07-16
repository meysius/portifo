import { z } from "zod";
import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { users } from "@/domain/identity/identity.schema";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [unique().on(table.endpoint)],
);

const PushSubscriptionsSelectSchema = createSelectSchema(pushSubscriptions);
const PushSubscriptionsInsertSchema = createInsertSchema(pushSubscriptions);

export type PushSubscriptionsSelect = z.infer<typeof PushSubscriptionsSelectSchema>;
export type PushSubscriptionsInsert = z.infer<typeof PushSubscriptionsInsertSchema>;
