/**
 * Apply fix-schema-drift.sql via Node since psql isn't on Windows PATH.
 * Idempotent — safe to re-run.
 *
 *   $env:DATABASE_URL='...'
 *   node apply-schema-fix.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlPath = path.join(__dirname, 'fix-schema-drift.sql');
const raw = fs.readFileSync(sqlPath, 'utf8');

// Strip psql meta-commands (\echo, SELECT verifications) — we'll do verification
// in JS after the BEGIN/COMMIT block runs.
const main = raw.split(/^COMMIT;\s*$/m)[0] + 'COMMIT;\n';

(async () => {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  console.log('connected\n');

  try {
    console.log('--- applying ALTER TABLE block ---');
    await pg.query(main);
    console.log('✅ schema migrations committed\n');
  } catch (e) {
    console.error('❌ FAILED:', e.message, 'SQLSTATE:', e.code);
    await pg.end();
    process.exit(1);
  }

  console.log('--- weddings columns ---');
  const w = await pg.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='weddings' ORDER BY ordinal_position`,
  );
  console.log(w.rows.map(r => r.column_name).join(', '));

  console.log('\n--- bookings columns ---');
  const b = await pg.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='bookings' ORDER BY ordinal_position`,
  );
  console.log(b.rows.map(r => r.column_name).join(', '));

  console.log('\n--- wedding_tasks columns ---');
  const t = await pg.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='wedding_tasks' ORDER BY ordinal_position`,
  );
  console.log(t.rows.map(r => r.column_name).join(', '));

  await pg.end();
  console.log('\n✅ done — re-run diagnose-500s.js to confirm SELECTs now pass');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
