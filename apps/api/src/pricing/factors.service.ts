/**
 * Dynamic Pricing v1 — factor resolution
 *
 * Deterministically resolves the three ADR-001 multipliers for a given event
 * date from live data, scaled into the vendor's own bounds on the pricing rule:
 *
 *   MUHURAT   — from calendar_events (kind MUHURAT), weighted by auspicious_band.
 *               1 + (rule.muhuratMultiplier − 1) × bandWeight.  No muhurat → 1.
 *   OFFSEASON — from calendar_events (kind BLACKOUT) covering the date.
 *               rule.offSeasonMultiplier when in a blackout window, else 1.
 *   DEMAND    — from the vendor's own active booking density around the date.
 *               1 + (rule.demandMultiplier − 1) × densityRatio.
 *
 * No LLM, no randomness. The advisor then multiplies + clamps these (see
 * advisor.service.ts). Reference data is global (not tenant-scoped, like the
 * calendar router); the demand query is scoped to the vendor's own bookings.
 */

import { and, eq, gte, lte, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { calendarEvents, bookings } from '@smartshaadi/db';
import type { PricingRule, PricingFactor } from '@smartshaadi/types';
import type { FactorLabels } from './advisor.service.js';

/** auspicious_band → weight in [0,1]; interpolates the vendor's muhurat multiplier. */
const BAND_WEIGHT: Record<string, number> = {
  NONE: 0,
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.75,
  PEAK: 1,
};

/** ± window (days) over which the vendor's active bookings signal demand. */
const DEMAND_WINDOW_DAYS = 14;
/** Active bookings in the window that map to full demand (densityRatio = 1). */
const DEMAND_REFERENCE = 10;

/** Band → weight in [0,1]; unknown bands contribute nothing (weight 0). */
export function bandWeightFor(band: string): number {
  return BAND_WEIGHT[band] ?? 0;
}

/** Active-booking count → density ratio in [0,1], saturating at DEMAND_REFERENCE. */
export function densityRatio(activeCount: number): number {
  if (activeCount <= 0) return 0;
  return Math.min(1, activeCount / DEMAND_REFERENCE);
}

/**
 * Interpolate a vendor's multiplier by an intensity in [0,1]: intensity 0 → 1
 * (no effect), intensity 1 → the full multiplier. Keeps every factor bounded
 * between "no adjustment" and the vendor's own chosen bound.
 */
export function applyFactor(multiplier: number, intensity: number): number {
  return 1 + (multiplier - 1) * intensity;
}

export interface ResolvedFactors {
  factors: Record<PricingFactor, number>;
  labels: FactorLabels;
}

/** Add whole days to a YYYY-MM-DD string, returning YYYY-MM-DD (UTC, deterministic). */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True when a calendar row (single-day or range) covers the target date. */
export function covers(
  row: { eventDate: string; endDate: string | null },
  date: string,
): boolean {
  if (row.endDate) return row.eventDate <= date && date <= row.endDate;
  return row.eventDate === date;
}

/** Region-inclusive: national rows (region null) plus the caller's region. */
export function inRegion(rowRegion: string | null, region: string | null | undefined): boolean {
  if (rowRegion === null) return true;
  if (!region) return false;
  return rowRegion === region;
}

/**
 * Resolve the three factor multipliers for a vendor + service on a given date.
 */
export async function resolveFactors(params: {
  rule: PricingRule;
  vendorId: string;
  date: string; // YYYY-MM-DD
  region?: string | null;
}): Promise<ResolvedFactors> {
  const { rule, vendorId, date, region } = params;

  // ── MUHURAT ────────────────────────────────────────────────────────────────
  const muhuratRows = await db
    .select({
      name: calendarEvents.name,
      region: calendarEvents.region,
      auspiciousBand: calendarEvents.auspiciousBand,
    })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.kind, 'MUHURAT'), eq(calendarEvents.eventDate, date)));

  let bandWeight = 0;
  let muhuratLabel: string | null = null;
  for (const row of muhuratRows) {
    if (!inRegion(row.region, region)) continue;
    const w = bandWeightFor(row.auspiciousBand);
    if (w >= bandWeight && w > 0) {
      bandWeight = w;
      muhuratLabel = `${row.name} (${row.auspiciousBand})`;
    }
  }
  const muhurat = applyFactor(rule.muhuratMultiplier, bandWeight);

  // ── OFFSEASON (BLACKOUT windows) ─────────────────────────────────────────────
  const blackoutRows = await db
    .select({
      name: calendarEvents.name,
      region: calendarEvents.region,
      eventDate: calendarEvents.eventDate,
      endDate: calendarEvents.endDate,
    })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.kind, 'BLACKOUT'), lte(calendarEvents.eventDate, date)));

  let offSeasonLabel: string | null = null;
  for (const row of blackoutRows) {
    if (!inRegion(row.region, region)) continue;
    if (covers(row, date)) {
      offSeasonLabel = row.name;
      break;
    }
  }
  const offSeason = offSeasonLabel !== null ? rule.offSeasonMultiplier : 1;

  // ── DEMAND (vendor's own active booking density) ─────────────────────────────
  const from = addDays(date, -DEMAND_WINDOW_DAYS);
  const to = addDays(date, DEMAND_WINDOW_DAYS);
  const densityRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        inArray(bookings.status, ['PENDING', 'CONFIRMED']),
        gte(bookings.eventDate, from),
        lte(bookings.eventDate, to),
      ),
    );
  const activeCount = densityRows[0]?.count ?? 0;
  const demand = applyFactor(rule.demandMultiplier, densityRatio(activeCount));
  const demandLabel = activeCount > 0 ? `${activeCount} active bookings nearby` : null;

  return {
    factors: { MUHURAT: muhurat, OFFSEASON: offSeason, DEMAND: demand },
    labels: { muhurat: muhuratLabel, offSeason: offSeasonLabel, demand: demandLabel },
  };
}
