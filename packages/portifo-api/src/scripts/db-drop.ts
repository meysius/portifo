import 'dotenv/config';
import pg from 'pg';

(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.slice(1).split('?')[0];

  url.pathname = '/postgres';
  const client = new pg.Client({ connectionString: url.toString() });

  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await client.end();

  console.log(`Database "${dbName}" dropped.`);
})();
