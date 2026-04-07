import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
import { resolve } from 'path';

// drizzle-kit runs with CWD = packages/db/
// Load the monorepo root .env (two levels up)
config({ path: resolve(__dirname, '../../.env') });

const url = process.env['DATABASE_URL'];
if (!url) {
  throw new Error('DATABASE_URL is not set. Check your root .env file.');
}

export default defineConfig({
  schema: './schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
});
