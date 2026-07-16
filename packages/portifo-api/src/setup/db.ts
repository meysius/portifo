import { Pool } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Config } from '@/setup/config';
import * as identitySchema from "@/domain/identity/identity.schema";
import * as portfolioSchema from "@/domain/portfolio/portfolio.schema";
import * as pushSchema from "@/domain/push/push.schema";

export const schema = {
  ...identitySchema,
  ...portfolioSchema,
  ...pushSchema,
};

export type Schema = typeof schema;

export type DrizzleDb = NodePgDatabase<Schema>;

export function createDbClient(config: Config): DrizzleDb {
  const client = new Pool({ connectionString: config.DATABASE_URL });
  return drizzle<Schema>({ client });
}