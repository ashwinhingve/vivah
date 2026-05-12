/**
 * Vendor engine — event router.
 *
 * Scores a vendor's fit for a proposed event across event type, calendar
 * availability, and location. Used by:
 *   - POST /api/v1/vendor-engine/route (admin / coordinator selection tool)
 *   - GET  /api/v1/vendor-engine/vendors/:id/pipeline (vendor view, just to
 *     surface near-term bookings; routing math isn't run there)
 *
 * No schema changes — reads from vendors, vendor_event_types,
 * vendor_blocked_dates, and bookings only.
 */
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import {
  vendors,
  vendorEventTypes,
  vendorBlockedDates,
  bookings,
} from '@smartshaadi/db';

export type EventType =
  | 'WEDDING'
  | 'CORPORATE'
  | 'FESTIVAL'
  | 'COMMUNITY_EVENT'
  | 'COMMUNITY'
  | 'GOVERNMENT'
  | 'SCHOOL'
  | 'OTHER'
  | 'HALDI'
  | 'MEHNDI'
  | 'SANGEET'
  | 'ENGAGEMENT'
  | 'RECEPTION';

export interface EventLocation {
  city?: string | null | undefined;
  state?: string | null | undefined;
}

export interface RouteResult {
  vendor_id: string;
  routable:  boolean;
  score:     number; // 0-100
  reasons:   string[];
  estimated_capacity_pct: number; // 0-100, higher = more booked that week
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * Score a single vendor for a proposed event. All reads are scoped to that
 * vendor; safe to fan out via Promise.all for batch routing.
 */
export async function routeVendorToEvent(
  vendorId: string,
  eventType: EventType,
  eventDate: Date,
  eventLocation: EventLocation = {},
): Promise<RouteResult> {
  const eventDateStr = toDateOnly(eventDate);
  const weekStart    = toDateOnly(shiftDays(eventDate, -2));
  const weekEnd      = toDateOnly(shiftDays(eventDate, 2));

  const [vendorRow, eventTypeRow, blockedRow, nearbyBookings] = await Promise.all([
    db.select({
        id:    vendors.id,
        city:  vendors.city,
        state: vendors.state,
        isActive: vendors.isActive,
      })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1)
      .then(r => r[0])
      .catch(() => undefined),

    db.select({
        available: vendorEventTypes.available,
      })
      .from(vendorEventTypes)
      .where(
        and(
          eq(vendorEventTypes.vendorId, vendorId),
          eq(vendorEventTypes.eventType, eventType),
        ),
      )
      .limit(1)
      .then(r => r[0])
      .catch(() => undefined),

    db.select({ date: vendorBlockedDates.date })
      .from(vendorBlockedDates)
      .where(
        and(
          eq(vendorBlockedDates.vendorId, vendorId),
          eq(vendorBlockedDates.date, eventDateStr),
        ),
      )
      .limit(1)
      .then(r => r[0])
      .catch(() => undefined),

    db.select({ id: bookings.id, eventDate: bookings.eventDate })
      .from(bookings)
      .where(
        and(
          eq(bookings.vendorId, vendorId),
          gte(bookings.eventDate, weekStart),
          lte(bookings.eventDate, weekEnd),
          inArray(bookings.status, ['PENDING', 'CONFIRMED']),
        ),
      )
      .catch(() => []),
  ]);

  const reasons: string[] = [];
  if (!vendorRow || vendorRow.isActive === false) {
    return {
      vendor_id: vendorId,
      routable:  false,
      score:     0,
      reasons:   ['vendor_inactive_or_missing'],
      estimated_capacity_pct: 0,
    };
  }

  if (blockedRow) {
    return {
      vendor_id: vendorId,
      routable:  false,
      score:     0,
      reasons:   ['date_blocked'],
      estimated_capacity_pct: 100,
    };
  }

  if (eventTypeRow && eventTypeRow.available === false) {
    return {
      vendor_id: vendorId,
      routable:  false,
      score:     0,
      reasons:   ['event_type_disabled'],
      estimated_capacity_pct: 0,
    };
  }

  let score = 50;
  reasons.push('base_available');

  if (eventTypeRow && eventTypeRow.available === true) {
    score += 20;
    reasons.push('event_type_enabled');
  } else if (!eventTypeRow) {
    reasons.push('event_type_unconfigured');
  }

  const cityMatch  = eventLocation.city && vendorRow.city &&
    vendorRow.city.toLowerCase() === eventLocation.city.toLowerCase();
  const stateMatch = eventLocation.state && vendorRow.state &&
    vendorRow.state.toLowerCase() === eventLocation.state.toLowerCase();
  if (cityMatch) {
    score += 15;
    reasons.push('city_match');
  } else if (stateMatch) {
    score += 10;
    reasons.push('state_match');
  }

  const drag = Math.min(30, nearbyBookings.length * 10);
  if (drag > 0) {
    score -= drag;
    reasons.push(`same_week_bookings:${nearbyBookings.length}`);
  }

  score = Math.max(0, Math.min(100, score));
  const capacityPct = Math.min(100, nearbyBookings.length * 20);

  return {
    vendor_id: vendorId,
    routable:  true,
    score,
    reasons,
    estimated_capacity_pct: capacityPct,
  };
}
