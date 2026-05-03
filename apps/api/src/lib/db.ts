import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env.js';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[pg] idle client error:', err.message);
});

export { pool };

// Relational schema intentionally omitted — API uses db.select().from(...) everywhere.
// Registering `{ schema }` breaks prod builds because drizzle's extractor crashes
// on one of the re-exported namespace entries under compiled CJS interop.
export const db = drizzle(pool);
