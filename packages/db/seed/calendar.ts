/**
 * calendar.ts — Calendar Intelligence seed (Phase 5 Tier 1).
 *
 * Populates `calendar_events` from the curated single-source-of-truth dataset
 * (seed/data/calendar-2026-2027.json) — the SAME file the Python muhurat engine
 * reads. Deterministic data only: vivah muhurats + national/regional festivals +
 * govt holidays + school-calendar windows. No users, no vendors, no LLM.
 *
 * Disputed-date promotion is driven by the dataset `conventions` block (resolved
 * in calendar-data.ts). Defaults promote nothing, so a re-seed is additive.
 *
 * Idempotency: `calendar_events` has no content-unique constraint and we must NOT
 * add a migration (the table already exists in prod). So we dedupe at the app
 * level — read existing (kind, event_date, name, region, community) keys for our
 * source tag and insert ONLY the missing rows. Additive-only, safe to re-run.
 *
 * Run (PowerShell, per repo convention):
 *   $env:DATABASE_URL = '...'; pnpm --filter @smartshaadi/db db:seed:calendar
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { calendarEvents } from '../schema/index.js';
import { applyConventions, buildRows, communityOf, loadDataset, rowKey } from './calendar-data.js';

config({ path: resolve(__dirname, '../../../.env') });

// Re-export the pure helpers so existing importers keep working.
export { applyConventions, buildRows, communityOf, loadDataset, rowKey };
export type { CalendarDataset, CalendarRow, Conventions } from './calendar-data.js';

export async function seedCalendar(db: ReturnType<typeof drizzle>): Promise<void> {
  const data = loadDataset();
  const rows = buildRows(data);

  // Existing keys for this source tag → dedupe target (no schema change needed).
  const existing = await db
    .select({
      kind: calendarEvents.kind,
      eventDate: calendarEvents.eventDate,
      name: calendarEvents.name,
      region: calendarEvents.region,
      metadata: calendarEvents.metadata,
    })
    .from(calendarEvents)
    .where(eq(calendarEvents.source, data.version));
  const seen = new Set(
    existing.map((e) =>
      rowKey({ kind: e.kind, eventDate: e.eventDate, name: e.name, region: e.region, community: communityOf(e.metadata) }),
    ),
  );

  const missing = rows.filter(
    (r) =>
      !seen.has(
        rowKey({
          kind: r.kind,
          eventDate: r.eventDate,
          name: r.name,
          region: r.region,
          community: communityOf(r.metadata),
        }),
      ),
  );

  if (missing.length > 0) {
    await db.insert(calendarEvents).values(missing);
  }

  const byKind = (k: string): number => rows.filter((r) => r.kind === k).length;
  // Regional breakdown by region / community for the by-kind+region recount.
  const regionalCounts = rows
    .filter((r) => r.region != null || communityOf(r.metadata) != null)
    .reduce<Record<string, number>>((acc, r) => {
      const key = communityOf(r.metadata) ? `community:${communityOf(r.metadata)}` : (r.region ?? 'national');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  const promotedCount = applyConventions(data).length;
  console.log(
    `📅 Calendar seed (${data.version}): ${rows.length} curated rows ` +
      `[MUHURAT=${byKind('MUHURAT')} FESTIVAL=${byKind('FESTIVAL')} GOVT=${byKind('GOVT')} SCHOOL=${byKind('SCHOOL')}]\n` +
      `   regional/community + region-tagged rows: ${JSON.stringify(regionalCounts)}\n` +
      `   convention-promoted disputed rows: ${promotedCount} ${JSON.stringify(data.conventions)}\n` +
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
