import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env.js';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// Relational schema intentionally omitted — API uses db.select().from(...) everywhere.
// Registering `{ schema }` breaks prod builds because drizzle's extractor crashes
// on one of the re-exported namespace entries under compiled CJS interop.
export const db = drizzle(pool);
