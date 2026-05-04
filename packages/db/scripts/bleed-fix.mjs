#!/usr/bin/env node
/**
 * Targeted bleed-fix for prod.
 *
 * Applies only the columns + tables that Better Auth needs to stop crashing
 * on /api/auth/phone-number/* — auth_events table + 3 user columns.
 *
 * Safe to re-run (every statement is IF NOT EXISTS).
 *
 *   $env:DATABASE_URL = '<prod-postgres-url>'
 *   node packages/db/scripts/bleed-fix.mjs
 *   Remove-Item Env:\DATABASE_URL
 */
import pg from 'pg';
const { Client } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set.');
  process.exit(1);
}

const STATEMENTS = [
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp`,
  `CREATE TABLE IF NOT EXISTS "auth_events" (
     "id"          text PRIMARY KEY NOT NULL,
     "user_id"     text REFERENCES "user"("id") ON DELETE CASCADE,
     "type"        text NOT NULL,
     "ip_address"  text,
     "user_agent"  text,
     "metadata"    jsonb,
     "created_at"  timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS "auth_events_user_time_idx" ON "auth_events" ("user_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "auth_events_type_time_idx" ON "auth_events" ("type", "created_at")`,
  `CREATE TABLE IF NOT EXISTS "two_factor" (
     "id"           text PRIMARY KEY NOT NULL,
     "user_id"      text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
     "secret"       text NOT NULL,
     "backup_codes" text NOT NULL,
     "created_at"   timestamp NOT NULL DEFAULT now(),
     "updated_at"   timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS "two_factor_user_idx" ON "two_factor" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "user_deletion_idx" ON "user" ("deletion_requested_at")`,
];

const client = new Client({ connectionString: url });
await client.connect();

for (let i = 0; i < STATEMENTS.length; i++) {
  const stmt = STATEMENTS[i];
  const head = stmt.replace(/\s+/g, ' ').slice(0, 90);
  try {
    await client.query(stmt);
    console.log(`  [${i + 1}/${STATEMENTS.length}] ✓ ${head}`);
  } catch (e) {
    console.error(`  [${i + 1}/${STATEMENTS.length}] ✗ ${e.code}: ${e.message}`);
  }
}

await client.end();
console.log('\nbleed-fix done. Restart Railway API container to flush better-auth schema cache.');
