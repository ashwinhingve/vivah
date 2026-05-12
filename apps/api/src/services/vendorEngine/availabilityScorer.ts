/**
 * Vendor engine — utilization scorer.
 *
 * Computes the trailing 12-month booking spread per vendor. Output is
 * cached in Redis (vendor:utilization:{vendorId}, 36h TTL) by the nightly
 * job and read by the pipeline endpoint. The route falls back to live
 * compute if the cache key is missing.
 */
import { eq, and, gte, inArray } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { bookings } from '@smartshaadi/db';
import { redis } from '../../lib/redis.js';

export interface UtilizationStats {
  total_12m: number;
  by_type: {
    WEDDING: number;
    CORPORATE: number;
    FESTIVAL: number;
    COMMUNITY_EVENT: number;
    OTHER: number;
  };
  diversity_score: number; // 0-1 (higher = more diverse event mix)
  off_season_pct:  number; // 0-100, % of bookings outside Oct-Feb peak
}

export const UTILIZATION_CACHE_TTL_SEC = 36 * 3600; // 36h
export const UTILIZATION_CACHE_PREFIX  = 'vendor:utilization:';

const COUNTED_TYPES = ['WEDDING', 'CORPORATE', 'FESTIVAL', 'COMMUNITY_EVENT'] as const;
type CountedType = (typeof COUNTED_TYPES)[number];

function emptyByType(): UtilizationStats['by_type'] {
  return { WEDDING: 0, CORPORATE: 0, FESTIVAL: 0, COMMUNITY_EVENT: 0, OTHER: 0 };
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function isPeakMonth(dateStr: string): boolean {
  // Indian wedding peak: October–February (months 10, 11, 12, 1, 2).
  const month = Number(dateStr.slice(5, 7));
  return month >= 10 || month <= 2;
}

export async function computeVendorUtilization(
  vendorId: string,
): Promise<UtilizationStats> {
  const cutoff = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const rows = await db
    .select({ ceremonyType: bookings.ceremonyType, eventDate: bookings.eventDate })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        gte(bookings.eventDate, cutoff),
        inArray(bookings.status, ['PENDING', 'CONFIRMED', 'COMPLETED']),
      ),
    )
    .catch(() => []);

  const by_type = emptyByType();
  let offSeason = 0;

  for (const row of rows) {
    const ct = row.ceremonyType as string;
    if ((COUNTED_TYPES as readonly string[]).includes(ct)) {
      by_type[ct as CountedType] += 1;
    } else {
      by_type.OTHER += 1;
    }
    if (!isPeakMonth(row.eventDate)) offSeason += 1;
  }

  const total_12m = rows.length;
  const counts    = COUNTED_TYPES.map(t => by_type[t]);
  const diversity = 1 / (1 + stddev(counts));
  const off_season_pct = total_12m === 0 ? 0 : Math.round((offSeason / total_12m) * 100);

  return {
    total_12m,
    by_type,
    diversity_score: Number(diversity.toFixed(3)),
    off_season_pct,
  };
}

export async function readCachedUtilization(
  vendorId: string,
): Promise<UtilizationStats | null> {
  try {
    const raw = await redis.get(`${UTILIZATION_CACHE_PREFIX}${vendorId}`);
    if (!raw) return null;
    return JSON.parse(raw) as UtilizationStats;
  } catch {
    return null;
  }
}

export async function writeCachedUtilization(
  vendorId: string,
  stats: UtilizationStats,
): Promise<void> {
  try {
    await redis.set(
      `${UTILIZATION_CACHE_PREFIX}${vendorId}`,
      JSON.stringify(stats),
      'EX',
      UTILIZATION_CACHE_TTL_SEC,
    );
  } catch {
    // best-effort cache write
  }
}

export async function getVendorUtilization(
  vendorId: string,
): Promise<UtilizationStats> {
  const cached = await readCachedUtilization(vendorId);
  if (cached) return cached;
  const fresh = await computeVendorUtilization(vendorId);
  await writeCachedUtilization(vendorId, fresh);
  return fresh;
}
