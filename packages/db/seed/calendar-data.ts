/**
 * calendar-data.ts — pure dataset + convention-resolver logic for the calendar seed.
 *
 * Deliberately free of runtime DB deps (drizzle/pg): it imports `calendarEvents`
 * as a TYPE ONLY, so these functions can be unit-tested with `tsc → node` without
 * a Postgres driver or the esbuild/tsx toolchain. The DB-touching seed wrapper
 * lives in calendar.ts and re-uses everything exported here.
 *
 * Mirrors apps/ai-service/src/services/calendar_service.py (same resolver semantics).
 */
import { resolve } from 'path';
import { readFileSync } from 'node:fs';
import type { calendarEvents } from '../schema/index.js';

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

interface Muhurat {
  date: string;
  band: AuspiciousBand;
  tithi: string | null;
  nakshatra: string | null;
}

/** SCHOOL-calendar blackout window (date -> endDate). `sources` documents provenance. */
interface SchoolWindow {
  name: string;
  date: string;
  endDate: string;
  region: string | null;
  note?: string;
  sources?: string[];
}

/**
 * Panchang-convention switches. Defaults reproduce the conservative live set
 * (nothing promoted). Flip one value + re-seed to enact an authority ruling.
 */
export interface Conventions {
  devshayani: 'amanta-6jul' | 'drik-25jul';
  january_post_sankranti: 'omit' | 'include';
  vishu_day: 'unset' | 'apr-14' | 'apr-15';
  onam_reckoning: 'unset' | 'aug-26' | 'sep-01';
}

/** A disputed muhurat bucket gated by one convention key. */
interface MuhuratBucket {
  gatedBy: keyof Conventions;
  promoteWhen: string;
  kind: 'MUHURAT';
  muhurats: Muhurat[];
}

/** A disputed regional festival whose date is chosen by a convention value. */
interface RegionalDisputed {
  name: string;
  region: string | null;
  community: string | null;
  gatedBy: keyof Conventions;
  candidates: Record<string, string>;
  astronomicalEvent?: string | null;
  note?: string;
}

interface Disputed {
  julyPendingAuthority: MuhuratBucket;
  januaryOmittedPendingAuthority: MuhuratBucket;
  regionalPendingAuthority: RegionalDisputed[];
  // schoolPendingAuthority / observancesPendingAuthority are documentation-only
  // (no promotion path) — intentionally not typed here.
}

export interface CalendarDataset {
  version: string;
  muhurats: Muhurat[];
  festivals: Array<{ date: string; name: string }>;
  regionalFestivals?: RegionalFestival[];
  govt: Array<{ date: string; name: string }>;
  schoolWindows?: SchoolWindow[];
  conventions: Conventions;
  disputed: Disputed;
}

export type CalendarRow = typeof calendarEvents.$inferInsert;

export function loadDataset(): CalendarDataset {
  const path = resolve(__dirname, 'data/calendar-2026-2027.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as CalendarDataset;
}

/**
 * Resolve the `disputed` buckets against `conventions` into live rows.
 * Pure & deterministic. With the dataset defaults nothing is promoted, so the
 * live set stays byte-identical to today; flip one convention value to admit a
 * bucket (July/Jan → MUHURAT rows, Vishu/Onam → regional FESTIVAL rows).
 */
export function applyConventions(
  data: CalendarDataset,
  conventions: Conventions = data.conventions,
): CalendarRow[] {
  const source = data.version;
  const promoted: CalendarRow[] = [];

  const promoteMuhurats = (bucket: MuhuratBucket): void => {
    if (conventions[bucket.gatedBy] !== bucket.promoteWhen) return;
    for (const m of bucket.muhurats) {
      promoted.push({
        kind: 'MUHURAT',
        name: 'Vivah Muhurat',
        eventDate: m.date,
        region: null,
        source,
        auspiciousBand: m.band,
        metadata: { tithi: m.tithi, nakshatra: m.nakshatra },
      });
    }
  };
  promoteMuhurats(data.disputed.julyPendingAuthority);
  promoteMuhurats(data.disputed.januaryOmittedPendingAuthority);

  for (const r of data.disputed.regionalPendingAuthority) {
    const date = r.candidates[conventions[r.gatedBy]];
    if (!date) continue; // 'unset' or unmatched value → held out
    const metadata: Record<string, string> = {};
    if (r.community) metadata['community'] = r.community;
    if (r.astronomicalEvent) metadata['astronomicalEvent'] = r.astronomicalEvent;
    if (r.note) metadata['note'] = r.note;
    promoted.push({
      kind: 'FESTIVAL',
      name: r.name,
      eventDate: date,
      region: r.region,
      source,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
  }
  return promoted;
}

export function buildRows(
  data: CalendarDataset,
  conventions: Conventions = data.conventions,
): CalendarRow[] {
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
  // SCHOOL-calendar blackout windows (eventDate -> endDate) — affect wedding
  // scheduling. National (region null, e.g. CBSE) or region-tagged (e.g. Delhi).
  for (const s of data.schoolWindows ?? []) {
    const metadata: Record<string, unknown> = {};
    if (s.note) metadata['note'] = s.note;
    if (s.sources) metadata['sources'] = s.sources;
    rows.push({
      kind: 'SCHOOL',
      name: s.name,
      eventDate: s.date,
      endDate: s.endDate,
      region: s.region,
      source,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
  }
  // Convention-gated disputed rows — empty under the conservative defaults.
  rows.push(...applyConventions(data, conventions));
  return rows;
}

/** community tag, read out of the jsonb metadata blob (null for most rows). */
export const communityOf = (metadata: unknown): string | null => {
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
  region?: string | null | undefined;
  community?: string | null | undefined;
}): string => `${r.kind}|${r.eventDate}|${r.name}|${r.region ?? ''}|${r.community ?? ''}`;
