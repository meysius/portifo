import { z } from "zod";
import { pgEnum, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-zod";

export const memberRoleEnum = pgEnum("member_role", ["viewer", "editor", "owner"]);

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  googleId: varchar({ length: 255 }).notNull().unique(),
  email: varchar({ length: 255 }).notNull().unique(),
  name: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const portfolios = pgTable("portfolios", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Nullable: a member added by email before that address has ever signed
    // in has no user row to point at yet. AuthController attaches userId the
    // first time that Gmail address logs in (see IdentityService.activatePendingMembers).
    userId: uuid().references(() => users.id, { onDelete: "cascade" }),
    // The invited email, always set — it's the actual access grant (matched
    // against Google Sign-In), not just a display fallback for pending rows.
    email: varchar({ length: 255 }).notNull(),
    portfolioId: uuid()
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    role: memberRoleEnum().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [unique().on(table.email, table.portfolioId)],
);

const UsersSelectSchema = createSelectSchema(users);
const UsersInsertSchema = createInsertSchema(users);
const UsersUpdateSchema = createUpdateSchema(users);

export type UsersSelect = z.infer<typeof UsersSelectSchema>;
export type UsersInsert = z.infer<typeof UsersInsertSchema>;
export type UsersUpdate = z.infer<typeof UsersUpdateSchema>;

const PortfoliosSelectSchema = createSelectSchema(portfolios);
const PortfoliosInsertSchema = createInsertSchema(portfolios);
const PortfoliosUpdateSchema = createUpdateSchema(portfolios);

export type PortfoliosSelect = z.infer<typeof PortfoliosSelectSchema>;
export type PortfoliosInsert = z.infer<typeof PortfoliosInsertSchema>;
export type PortfoliosUpdate = z.infer<typeof PortfoliosUpdateSchema>;

const MembersSelectSchema = createSelectSchema(members);
const MembersInsertSchema = createInsertSchema(members);
const MembersUpdateSchema = createUpdateSchema(members);

export type MembersSelect = z.infer<typeof MembersSelectSchema>;
export type MembersInsert = z.infer<typeof MembersInsertSchema>;
export type MembersUpdate = z.infer<typeof MembersUpdateSchema>;
