#!/usr/bin/env node
/**
 * Production schema-sync runner.
 *
 * Reads packages/db/scripts/prod-sync.sql, splits on '--> statement-breakpoint',
 * applies each statement against $env:DATABASE_URL, and tolerates
 * "already exists" errors so the script is idempotent.
 *
 * Run from PowerShell (Windows) — WSL on this dev box can't reach Railway proxy.
 *
 *   $env:DATABASE_URL = '<prod-postgres-url>'
 *   node packages/db/scripts/run-prod-sync.mjs
 *   Remove-Item Env:\DATABASE_URL
 *
 * Tolerated error codes:
 *   42P07  duplicate_table
 *   42701  duplicate_column
 *   42710  duplicate_object  (e.g. constraint already there)
 *   42P06  duplicate_schema
 *   42P16  invalid_table_definition  (PK-bound col — only on Better Auth tables; safe to skip)
 *   42P09  invalid_object_definition
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const { Client } = pg;

const TOLERATED = new Set([
  '42P07', // duplicate_table
  '42701', // duplicate_column
  '42710', // duplicate_object
  '42P06', // duplicate_schema
  '42P16', // invalid_table_def — Better Auth PK type drift, intentionally skipped
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, 'prod-sync.sql');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set. Set $env:DATABASE_URL first.');
  process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf8');
// Split on drizzle's statement-breakpoint marker, drop empties.
const statements = sql
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`[prod-sync] ${statements.length} statements queued`);

const client = new Client({ connectionString: url });
await client.connect();

let ok = 0;
let skipped = 0;
let errored = 0;
const errors = [];

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const summary = stmt.split('\n')[0].slice(0, 120);
  try {
    await client.query(stmt);
    ok++;
    if (i % 25 === 0) console.log(`  [${i + 1}/${statements.length}] ✓ ${summary}`);
  } catch (e) {
    if (TOLERATED.has(e.code)) {
      skipped++;
      console.log(`  [${i + 1}/${statements.length}] ⊘ skipped (${e.code}): ${summary}`);
    } else {
      errored++;
      errors.push({ idx: i + 1, code: e.code, msg: e.message, stmt: summary });
      console.error(`  [${i + 1}/${statements.length}] ✗ ${e.code} — ${e.message}`);
    }
  }
}

await client.end();

console.log(`\n[prod-sync] applied=${ok} skipped=${skipped} errored=${errored}`);
if (errors.length) {
  console.error('\nFatal errors (review and fix manually):');
  for (const e of errors) console.error(`  #${e.idx} (${e.code}): ${e.stmt} — ${e.msg}`);
  process.exit(1);
}
