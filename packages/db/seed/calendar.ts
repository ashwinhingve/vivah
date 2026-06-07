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

interface RegionalFestival {
  date: string;
  name: string;
  region: string | null;
  community: string | null;
  astronomicalEvent: string | null;
  note: string | null;
}

interface CalendarDataset {
  version: string;
  muhurats: Array<{ date: string; band: AuspiciousBand; tithi: string; nakshatra: string }>;
  festivals: Array<{ date: string; name: string }>;
  regionalFestivals?: RegionalFestival[];
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
  for (const rf of data.regionalFestivals ?? []) {
    // Regional/community variants are FESTIVAL rows discriminated by `region`
    // (and metadata.community). NOT kind=REGIONAL — so a kind=FESTIVAL query
    // still surfaces them. community lives in metadata for endpoint filtering.
    const metadata: Record<string, string> = {};
    if (rf.community) metadata['community'] = rf.community;
    if (rf.astronomicalEvent) metadata['astronomicalEvent'] = rf.astronomicalEvent;
    if (rf.note) metadata['note'] = rf.note;
    rows.push({
      kind: 'FESTIVAL',
      name: rf.name,
      eventDate: rf.date,
      region: rf.region,
      source,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
  }
  for (const g of data.govt) {
    rows.push({ kind: 'GOVT', name: g.name, eventDate: g.date, region: null, source });
  }
  return rows;
}

/** community tag, read out of the jsonb metadata blob (null for most rows). */
const communityOf = (metadata: unknown): string | null => {
  if (metadata && typeof metadata === 'object' && 'community' in metadata) {
    const c = (metadata as { community?: unknown }).community;
    return typeof c === 'string' ? c : null;
  }
  return null;
};

// Dedupe key includes region + community so regional variants on a shared date
// (e.g. Pongal/TN + Uttarayan/Gujarat both 14-Jan) are distinct rows, while
// national rows (region null, no community) keep the SAME key already in prod —
// additive, idempotent, ON CONFLICT DO NOTHING-equivalent at the app level.
export const rowKey = (r: {
  kind: string;
  eventDate: string;
  name: string;
  region?: string | null;
  community?: string | null;
}): string => `${r.kind}|${r.eventDate}|${r.name}|${r.region ?? ''}|${r.community ?? ''}`;

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
  console.log(
    `📅 Calendar seed (${data.version}): ${rows.length} curated rows ` +
      `[MUHURAT=${byKind('MUHURAT')} FESTIVAL=${byKind('FESTIVAL')} GOVT=${byKind('GOVT')}]\n` +
      `   regional/community FESTIVAL rows: ${JSON.stringify(regionalCounts)}\n` +
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
