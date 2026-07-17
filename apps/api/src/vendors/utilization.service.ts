/**
 * Vendor Utilization Engine (VUE) — Ranking & Scoring
 *
 * Ranks a vendor's IDLE capacity windows for off-season NON-WEDDING event routing.
 *
 * Pure, deterministic ranking:
 *   1. Filter vendor_capacity: status OPEN, offSeason = true
 *   2. Match to vendor_event_types: event type available
 *   3. Score by remaining capacity (maxBookings - bookedCount)
 *   4. Rank: startAt ASC → remaining capacity DESC → id ASC (deterministic tiebreak)
 *
 * Non-wedding events: CORPORATE, FESTIVAL, COMMUNITY, COMMUNITY_EVENT, GOVERNMENT, SCHOOL
 *
 * Money: If reading legacy booking amounts (decimal rupees), convert explicitly
 * to paise via rupeesToPaise() for expectedMarginPaise field.
 */

import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { vendorCapacity, vendorEventTypes } from '@smartshaadi/db';
import { rupeesToPaise } from '../lib/money.js';
import { asProfileId } from '@smartshaadi/types';
import type { VendorCapacityWindow, ProfileId } from '@smartshaadi/types';

/** Non-wedding event types eligible for off-season routing. */
const NON_WEDDING_EVENTS = [
  'CORPORATE',
  'FESTIVAL',
  'COMMUNITY',
  'COMMUNITY_EVENT',
  'GOVERNMENT',
  'SCHOOL',
] as const;

export type NonWeddingEventType = typeof NON_WEDDING_EVENTS[number];

export interface UtilizationRankingOptions {
  /** Vendor's profile ID (from profiles.id) */
  profileId: ProfileId;

  /** Optional: filter to specific event type */
  eventType?: NonWeddingEventType | undefined;

  /** Optional: filter to windows after this date (ISO timestamp) */
  startAfter?: string | undefined;

  /** Optional: filter to windows before this date (ISO timestamp) */
  endBefore?: string | undefined;

  /** Reference date for deterministic sorting; defaults to now */
  referenceDate?: Date | undefined;
}

export interface RankedWindow {
  window: VendorCapacityWindow;
  remainingCapacity: number;
  eventTypeMatch: NonWeddingEventType;
}

/**
 * Pure, deterministic ranking function. No randomness, no Date.now() inside.
 * Deterministic tiebreak order: startAt ASC → remaining capacity DESC → id ASC.
 */
export function rankUtilizationWindows(
  windows: RankedWindow[],
): RankedWindow[] {
  return [...windows].sort((a, b) => {
    // 1. Earlier dates first
    const dateA = new Date(a.window.startAt).getTime();
    const dateB = new Date(b.window.startAt).getTime();
    if (dateA !== dateB) return dateA - dateB;

    // 2. Higher remaining capacity first (better fit for utilization)
    if (a.remainingCapacity !== b.remainingCapacity) {
      return b.remainingCapacity - a.remainingCapacity;
    }

    // 3. ID lexicographic (deterministic final tiebreak)
    return a.window.id.localeCompare(b.window.id);
  });
}

/**
 * Query vendor_capacity for OPEN, offSeason windows and match to available
 * event types. Returns ranked list of opportunities.
 *
 * Filters:
 *   - status: OPEN
 *   - offSeason: true
 *   - eventType (optional): must be in vendor_event_types with available=true
 *   - startAfter / endBefore (optional): window date range
 *
 * Returns ranked list + remaining capacity for each window.
 */
export async function queryVendorUtilizationOpportunities(
  options: UtilizationRankingOptions,
): Promise<RankedWindow[]> {
  const {
    profileId,
    eventType,
    startAfter,
    endBefore,
  } = options;

  // Query 1: Fetch OPEN, offSeason capacity windows for this vendor
  const conditions = [
    eq(vendorCapacity.profileId, profileId),
    eq(vendorCapacity.status, 'OPEN'),
    eq(vendorCapacity.offSeason, true),
  ];

  if (startAfter) {
    conditions.push(gte(vendorCapacity.startAt, new Date(startAfter)));
  }
  if (endBefore) {
    // Query windows that end before endBefore
    conditions.push(lte(vendorCapacity.endAt, new Date(endBefore)));
  }

  const windows = await db
    .select({
      id:          vendorCapacity.id,
      profileId:   vendorCapacity.profileId,
      startAt:     vendorCapacity.startAt,
      endAt:       vendorCapacity.endAt,
      status:      vendorCapacity.status,
      maxBookings: vendorCapacity.maxBookings,
      bookedCount: vendorCapacity.bookedCount,
      offSeason:   vendorCapacity.offSeason,
      notes:       vendorCapacity.notes,
      createdAt:   vendorCapacity.createdAt,
      updatedAt:   vendorCapacity.updatedAt,
    })
    .from(vendorCapacity)
    .where(and(...conditions));

  if (windows.length === 0) return [];

  // Query 2: Fetch available event types for this vendor
  const eventTypeFilter = eventType ? [eventType] : [...NON_WEDDING_EVENTS];
  const eventTypeRows = await db
    .select({
      eventType: vendorEventTypes.eventType,
    })
    .from(vendorEventTypes)
    .where(
      and(
        eq(vendorEventTypes.vendorId, profileId),
        inArray(vendorEventTypes.eventType, eventTypeFilter),
        eq(vendorEventTypes.available, true),
      ),
    );

  if (eventTypeRows.length === 0) return [];

  const availableTypes = new Set(eventTypeRows.map((r) => r.eventType as NonWeddingEventType));

  // Filter windows to only those with available event types and compute ranking
  const ranked: RankedWindow[] = windows
    .filter(() => availableTypes.size > 0)
    .map((w) => {
      const windowProfileId = asProfileId(w.profileId);
      return {
        window: {
          id:          w.id,
          profileId:   windowProfileId,
          startAt:     w.startAt.toISOString(),
          endAt:       w.endAt.toISOString(),
          status:      w.status,
          maxBookings: w.maxBookings,
          bookedCount: w.bookedCount,
          offSeason:   w.offSeason,
          notes:       w.notes,
          createdAt:   w.createdAt.toISOString(),
          updatedAt:   w.updatedAt.toISOString(),
        },
        remainingCapacity: w.maxBookings - w.bookedCount,
        // Pick first available type (deterministic, though vendor usually only handles one per category)
        eventTypeMatch: Array.from(availableTypes)[0]!,
      };
    });

  return rankUtilizationWindows(ranked);
}

/**
 * Compute expected margin (in paise) for a lead opportunity.
 * If lead_fee is stored as INR (integer), convert to paise.
 * Margin = lead_fee as paise.
 *
 * (Future: can add margin % calculation once pricing rules are wired.)
 */
export function computeExpectedMarginPaise(leadFeeInr: number): bigint {
  if (!Number.isFinite(leadFeeInr) || leadFeeInr < 0) {
    throw new Error(`Invalid lead fee: ${leadFeeInr}`);
  }
  return BigInt(rupeesToPaise(leadFeeInr));
}

/**
 * Score utilization fit: 0..1, higher = better.
 * Factors:
 *   - Remaining capacity ratio (max 0.5 points)
 *   - Recency: windows starting sooner score higher (max 0.5 points)
 *
 * Simple formula: (remaining / max) * 0.5 + (1 - daysUntilStart / 60) * 0.5
 * where daysUntilStart is capped at 60 days (future windows beyond 60d score 0).
 * Past windows (startAt < referenceDate) score 0 on recency.
 */
export function computeUtilizationScore(
  window: RankedWindow,
  referenceDate: Date,
): number {
  const remainingRatio = Math.min(1, window.remainingCapacity / window.window.maxBookings);
  const startMs = new Date(window.window.startAt).getTime();
  const refMs = referenceDate.getTime();
  const daysUntil = (startMs - refMs) / (1000 * 60 * 60 * 24);

  // Past windows (negative daysUntil) get 0 recency score
  // Future windows get 1 - (daysUntil / 60), clamped to [0, 1]
  const recencyScore = daysUntil < 0 ? 0 : Math.max(0, Math.min(1, 1 - daysUntil / 60));

  return remainingRatio * 0.5 + recencyScore * 0.5;
}
