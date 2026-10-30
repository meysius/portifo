import 'dotenv/config';
import pg from 'pg';
import { runMigrations } from 'bullmq';

// BullMQ keeps its tables in their own `bullmq` schema and never creates them
// at startup, so this runs with the Drizzle migrations: a failure here stops
// a deploy before the new release goes live.
(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  const version = await runMigrations(client);
  await client.end();

  console.log(`Job queue schema at version ${version}.`);
})();
