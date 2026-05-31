// Compare every table column the code expects vs what prod actually has.
// Reports tables/columns missing in prod. Read-only.
//
//   $env:DATABASE_URL='...'
//   node audit-all-schema.js
//
// Expected list is derived by parsing packages/db/schema/index.ts at run time.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SCHEMA_FILE = path.join(__dirname, 'packages', 'db', 'schema', 'index.ts');

function parseSchema(src) {
  const tables = {};
  const tableRe = /pgTable\(\s*'([a-z_][a-z0-9_]*)'\s*,\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = tableRe.exec(src)) !== null) {
    const name = m[1];
    const body = m[2];
    const colRe = /^[ \t]*[a-zA-Z_][a-zA-Z0-9_]*:\s*[a-zA-Z_]+\(\s*'([a-z_][a-z0-9_]*)'/gm;
    const cols = [];
    let cm;
    while ((cm = colRe.exec(body)) !== null) cols.push(cm[1]);
    tables[name] = [...new Set(cols)];
  }
  return tables;
}

(async () => {
  const src = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const expected = parseSchema(src);
  console.log(`parsed ${Object.keys(expected).length} tables from schema\n`);

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const drift = [];
  for (const [tbl, cols] of Object.entries(expected)) {
    const r = await pg.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1`,
      [tbl],
    );
    const actual = new Set(r.rows.map(x => x.column_name));
    const tableExists = r.rows.length > 0;
    if (!tableExists) {
      drift.push({ tbl, missingTable: true, missingCols: cols });
      continue;
    }
    const missing = cols.filter(c => !actual.has(c));
    if (missing.length > 0) drift.push({ tbl, missingCols: missing });
  }

  if (drift.length === 0) {
    console.log('all expected columns present');
  } else {
    console.log('drift detected:\n');
    for (const d of drift) {
      if (d.missingTable) {
        console.log(`  ${d.tbl}: TABLE MISSING (needs all ${d.missingCols.length} cols)`);
      } else {
        console.log(`  ${d.tbl}: missing ${d.missingCols.length} -> ${d.missingCols.join(', ')}`);
      }
    }
  }

  await pg.end();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
