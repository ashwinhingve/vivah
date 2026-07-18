/**
 * Smart Shaadi — Destination Wedding serializers (Phase 8 Sprint I, Unit 8.1)
 *
 * Row → wire mappers. The shapes returned here are the FROZEN contracts in
 * `@smartshaadi/types`; this module deliberately declares no interfaces of its
 * own, so the API and the web UI cannot drift apart.
 *
 * `arriveOn` / `departOn` / `arrivalDate` / `departureDate` map Postgres `date`
 * columns, which drizzle returns as `YYYY-MM-DD` STRINGS, not `Date` objects.
 * They pass straight through — calling `.toISOString()` on them is both a
 * compile error and a runtime crash.
 */

import type {
  WeddingDestination, DestinationSummary, GuestTravelLegWithGuest,
  DestinationCeremony,
} from '@smartshaadi/types';
import type { weddingDestinations, guestTravelLegs } from '@smartshaadi/db';

type DestinationRow = typeof weddingDestinations.$inferSelect;
type TravelRow      = typeof guestTravelLegs.$inferSelect;

export function serializeDestination(row: DestinationRow): WeddingDestination {
  return {
    id:           row.id,
    weddingId:    row.weddingId,
    city:         row.city,
    countryCode:  row.countryCode,
    ianaTimezone: row.ianaTimezone,
    arriveOn:     row.arriveOn,
    departOn:     row.departOn,
    sortOrder:    row.sortOrder,
    isPrimary:    row.isPrimary,
    notes:        row.notes,
    createdAt:    row.createdAt.toISOString(),
    updatedAt:    row.updatedAt.toISOString(),
  };
}

export function serializeSummary(
  row: DestinationRow,
  ceremonyCount: number,
  travellerCount: number,
): DestinationSummary {
  return { ...serializeDestination(row), ceremonyCount, travellerCount };
}

/**
 * Travel row plus the guest's display fields.
 *
 * Name and side ONLY — `guests` also carries phone and email, and CLAUDE.md
 * rule 5 keeps those out of API responses by default. A planner-facing screen is
 * not an exception to that.
 */
export function serializeTravelLeg(
  row: TravelRow,
  guestName: string,
  guestSide: string | null,
): GuestTravelLegWithGuest {
  return {
    id:            row.id,
    destinationId: row.destinationId,
    guestId:       row.guestId,
    arrivalDate:   row.arrivalDate,
    arrivalTime:   row.arrivalTime,
    departureDate: row.departureDate,
    departureTime: row.departureTime,
    travelNotes:   row.travelNotes,
    guestName,
    guestSide,
    createdAt:     row.createdAt.toISOString(),
    updatedAt:     row.updatedAt.toISOString(),
  };
}

/**
 * A ceremony as shown on a leg.
 *
 * `outsideWindow` is a SOFT flag: true when the ceremony has a date falling
 * outside the leg's arrive/depart window. It is surfaced so the planner notices,
 * never used to reject a write — placeholder dates while venues are still being
 * booked are normal. String comparison is correct because both sides are
 * zero-padded `YYYY-MM-DD`.
 */
export function serializeCeremony(
  row: { id: string; type: string; date: string | null; venue: string | null },
  arriveOn: string,
  departOn: string,
): DestinationCeremony {
  return {
    id:    row.id,
    type:  row.type,
    date:  row.date,
    venue: row.venue,
    outsideWindow: row.date !== null && (row.date < arriveOn || row.date > departOn),
  };
}
