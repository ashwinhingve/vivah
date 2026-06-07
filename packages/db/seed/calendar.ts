/**
 * calendar.ts — Calendar Intelligence seed (Phase 5 Tier 1).
 *
 * Populates `calendar_events` from the curated single-source-of-truth dataset
 * (seed/data/calendar-2026-2027.json) — the SAME file the Python muhurat engine
 * reads. Deterministic data only: vivah muhurats + national festivals + national
 * govt holidays. No users, no vendors, no LLM.
 *
 * Idempotency: `calendar_events` has no content-unique constraint and we must NOT
 * add a migration (the table already exists in prod). So we dedupe at the app
 * level — read existing (kind, event_date, name) keys for our source tag and
 * insert ONLY the missing rows. Additive-only (no deletes), safe to re-run.
 *
 * Run (PowerShell, per repo convention):
 *   $env:DATABASE_URL = '...'; pnpm --filter @smartshaadi/db db:seed:calendar
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'node:fs';
import { calendarEvents } from '../schema/index.js';

config({ path: resolve(__dirname, '../../../.env') });

// ── Dataset shape (matches seed/data/calendar-2026-2027.json) ─────────────────
type AuspiciousBand = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PEAK';

interface CalendarDataset {
  version: string;
  muhurats: Array<{ date: string; band: AuspiciousBand; tithi: string; nakshatra: string }>;
  festivals: Array<{ date: string; name: string }>;
  govt: Array<{ date: string; name: string }>;
}

type CalendarRow = typeof calendarEvents.$inferInsert;

export function loadDataset(): CalendarDataset {
  const path = resolve(__dirname, 'data/calendar-2026-2027.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as CalendarDataset;
}

export function buildRows(data: CalendarDataset): CalendarRow[] {
  const source = data.version;
  const rows: CalendarRow[] = [];

  for (const m of data.muhurats) {
    rows.push({
      kind: 'MUHURAT',
      name: 'Vivah Muhurat',
      eventDate: m.date,
      region: null,
      source,
      auspiciousBand: m.band,
      metadata: { tithi: m.tithi, nakshatra: m.nakshatra },
    });
  }
  for (const f of data.festivals) {
    rows.push({ kind: 'FESTIVAL', name: f.name, eventDate: f.date, region: null, source });
  }
  for (const g of data.govt) {
    rows.push({ kind: 'GOVT', name: g.name, eventDate: g.date, region: null, source });
  }
  return rows;
}

export const rowKey = (r: { kind: string; eventDate: string; name: string }): string =>
  `${r.kind}|${r.eventDate}|${r.name}`;

export async function seedCalendar(db: ReturnType<typeof drizzle>): Promise<void> {
  const data = loadDataset();
  const rows = buildRows(data);

  // Existing keys for this source tag → dedupe target (no schema change needed).
  const existing = await db
    .select({ kind: calendarEvents.kind, eventDate: calendarEvents.eventDate, name: calendarEvents.name })
    .from(calendarEvents)
    .where(eq(calendarEvents.source, data.version));
  const seen = new Set(existing.map(rowKey));

  const missing = rows.filter((r) => !seen.has(rowKey({ kind: r.kind, eventDate: r.eventDate, name: r.name })));

  if (missing.length > 0) {
    await db.insert(calendarEvents).values(missing);
  }

  const byKind = (k: string): number => rows.filter((r) => r.kind === k).length;
  console.log(
    `📅 Calendar seed (${data.version}): ${rows.length} curated rows ` +
      `[MUHURAT=${byKind('MUHURAT')} FESTIVAL=${byKind('FESTIVAL')} GOVT=${byKind('GOVT')}]\n` +
      `   inserted ${missing.length} new, skipped ${rows.length - missing.length} existing (idempotent).`,
  );
}

// ── CLI entry (tsx seed/calendar.ts) ──────────────────────────────────────────
async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
  const db = drizzle(pool);
  try {
    await seedCalendar(db);
  } finally {
    await pool.end();
  }
}

// Run only when invoked directly, not when imported.
if (process.argv[1] && process.argv[1].endsWith('calendar.ts')) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('❌ Calendar seed failed:', e);
      process.exit(1);
    });
}
