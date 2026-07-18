/**
 * Smart Shaadi — Destination Wedding Service (Phase 8 Sprint I, Unit 8.1)
 *
 * Multi-city wedding planning. A "destination" is a CITY LEG of one wedding
 * (Mehndi in Delhi, Wedding in Udaipur) — not a catalogue entry and not
 * something anyone can buy. Destination supply is Tier 3, blocked on venue and
 * vendor partnerships, so there is no price, package or booking here.
 *
 * Authorization is delegated to `requireRole` from '../weddings/access.js',
 * which already separates "no access at all" (NOT_FOUND, so wedding existence
 * does not leak) from "role too low" (FORBIDDEN). The router calls it per route;
 * the write helpers below additionally scope every statement by weddingId so a
 * leg id from another wedding cannot be reached even if a route ever forgot.
 *
 * Two invariants live in the DATABASE (migration 0036) rather than in reads here,
 * because a read-then-write check races under concurrent requests:
 *   * `destinations_one_primary_idx` — partial unique, one primary leg per wedding
 *   * `destinations_date_window_ck`  — CHECK (depart_on >= arrive_on)
 * Both are caught below by SQLSTATE and surfaced as domain errors instead of
 * escaping as a 500.
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  weddingDestinations, guestTravelLegs, ceremonies, guests, guestLists,
} from '@smartshaadi/db';
import type {
  WeddingDestination, DestinationSummary, GuestTravelLegWithGuest,
  DestinationDetail, DestinationDeleteResult,
} from '@smartshaadi/types';
import type {
  CreateDestinationInput, UpdateDestinationInput,
  UpsertGuestTravelLegInput, ReorderDestinationsInput,
} from '@smartshaadi/schemas';
import {
  serializeDestination, serializeSummary, serializeTravelLeg, serializeCeremony,
} from './serialize.js';

export class DestinationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DestinationError';
  }
}

/** pg SQLSTATEs the DB-enforced invariants surface as. */
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION  = '23514';

function pgCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const direct = (e as { code?: unknown }).code;
  if (typeof direct === 'string') return direct;
  // postgres-js/drizzle wrap the driver error one level down
  const cause = (e as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === 'string') return nested;
  }
  return undefined;
}

/**
 * Translate a DB constraint violation into the domain error it represents.
 * Anything else is rethrown untouched — swallowing an unknown DB error here
 * would turn a real bug into a misleading 400.
 */
function rethrowConstraint(e: unknown): never {
  const code = pgCode(e);
  const msg  = e instanceof Error ? e.message : String(e);
  if (code === UNIQUE_VIOLATION && msg.includes('destinations_one_primary_idx')) {
    throw new DestinationError('DUPLICATE_PRIMARY', 'This wedding already has a primary destination');
  }
  if (code === CHECK_VIOLATION && msg.includes('destinations_date_window_ck')) {
    throw new DestinationError('INVALID_DATE_RANGE', 'Departure must be on or after arrival');
  }
  throw e;
}

/**
 * Load one leg, scoped by wedding.
 *
 * Scoping by BOTH id and weddingId is what stops one wedding reading another's
 * leg by guessing a UUID; filtering on id alone would happily return it.
 */
async function loadLeg(weddingId: string, destinationId: string) {
  const [row] = await db
    .select()
    .from(weddingDestinations)
    .where(and(
      eq(weddingDestinations.id, destinationId),
      eq(weddingDestinations.weddingId, weddingId),
    ))
    .limit(1);
  if (!row) throw new DestinationError('NOT_FOUND', 'Destination not found');
  return row;
}

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * List legs with their ceremony and traveller counts.
 *
 * The counts come from two INDEPENDENT grouped subqueries, left-joined once.
 * Joining `ceremonies` and `guest_travel_legs` directly to the same row would
 * multiply them together — a leg with 2 ceremonies and 3 travellers would report
 * 6 of each — and it is still one round trip, not a query per leg.
 */
export async function listDestinations(weddingId: string): Promise<DestinationSummary[]> {
  const ceremonyCounts = db
    .select({
      destinationId: ceremonies.destinationId,
      n: sql<number>`count(*)::int`.as('n'),
    })
    .from(ceremonies)
    .where(eq(ceremonies.weddingId, weddingId))
    .groupBy(ceremonies.destinationId)
    .as('cc');

  const travelCounts = db
    .select({
      destinationId: guestTravelLegs.destinationId,
      n: sql<number>`count(*)::int`.as('n'),
    })
    .from(guestTravelLegs)
    .groupBy(guestTravelLegs.destinationId)
    .as('tc');

  const rows = await db
    .select({
      d: weddingDestinations,
      ceremonyCount:  sql<number>`coalesce(${ceremonyCounts.n}, 0)::int`,
      travellerCount: sql<number>`coalesce(${travelCounts.n}, 0)::int`,
    })
    .from(weddingDestinations)
    .leftJoin(ceremonyCounts, eq(ceremonyCounts.destinationId, weddingDestinations.id))
    .leftJoin(travelCounts,   eq(travelCounts.destinationId,   weddingDestinations.id))
    .where(eq(weddingDestinations.weddingId, weddingId))
    .orderBy(weddingDestinations.sortOrder, weddingDestinations.arriveOn);

  return rows.map((r) => serializeSummary(r.d, Number(r.ceremonyCount), Number(r.travellerCount)));
}

/** One leg plus the ceremonies held there and who is travelling to it. */
export async function getDestinationDetail(
  weddingId: string,
  destinationId: string,
): Promise<DestinationDetail> {
  const leg = await loadLeg(weddingId, destinationId);

  const ceremonyRows = await db
    .select({
      id: ceremonies.id, type: ceremonies.type,
      date: ceremonies.date, venue: ceremonies.venue,
    })
    .from(ceremonies)
    .where(and(
      eq(ceremonies.destinationId, destinationId),
      eq(ceremonies.weddingId, weddingId),
    ))
    .orderBy(ceremonies.date);

  return {
    destination: serializeDestination(leg),
    ceremonies:  ceremonyRows.map((c) => serializeCeremony(c, leg.arriveOn, leg.departOn)),
    travel:      await travelForLeg(destinationId),
  };
}

/**
 * Travel rows joined to the guest's display fields.
 *
 * Selects `name` and `side` ONLY. A bare `select()` here would have returned the
 * whole guest row, leaking phone and email (CLAUDE.md rule 5).
 */
async function travelForLeg(destinationId: string): Promise<GuestTravelLegWithGuest[]> {
  const rows = await db
    .select({ leg: guestTravelLegs, guestName: guests.name, guestSide: guests.side })
    .from(guestTravelLegs)
    .innerJoin(guests, eq(guests.id, guestTravelLegs.guestId))
    .where(eq(guestTravelLegs.destinationId, destinationId))
    .orderBy(guestTravelLegs.arrivalDate, guests.name);

  return rows.map((r) => serializeTravelLeg(r.leg, r.guestName, r.guestSide));
}

export async function listTravelLegs(
  weddingId: string,
  destinationId: string,
): Promise<GuestTravelLegWithGuest[]> {
  await loadLeg(weddingId, destinationId);
  return travelForLeg(destinationId);
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Create a leg. When `isPrimary` is requested the previous primary is cleared in
 * the SAME transaction, so the partial unique index never sees two primaries from
 * one caller. A concurrent second caller still loses on the index — which is the
 * point: it fails loudly as DUPLICATE_PRIMARY rather than corrupting quietly.
 */
export async function createDestination(
  weddingId: string,
  input: CreateDestinationInput,
): Promise<WeddingDestination> {
  try {
    return await db.transaction(async (tx) => {
      if (input.isPrimary) {
        await tx
          .update(weddingDestinations)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(
            eq(weddingDestinations.weddingId, weddingId),
            eq(weddingDestinations.isPrimary, true),
          ));
      }
      const [created] = await tx
        .insert(weddingDestinations)
        .values({
          weddingId,
          city:         input.city,
          countryCode:  input.countryCode,
          ianaTimezone: input.ianaTimezone,
          arriveOn:     input.arriveOn,
          departOn:     input.departOn,
          sortOrder:    input.sortOrder,
          isPrimary:    input.isPrimary,
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        })
        .returning();
      if (!created) throw new DestinationError('INTERNAL_ERROR', 'Insert returned no row');
      return serializeDestination(created);
    });
  } catch (e) {
    if (e instanceof DestinationError) throw e;
    return rethrowConstraint(e);
  }
}

/**
 * Update a leg. The WHERE carries both id and weddingId, so the write is atomic
 * and tenant-scoped in a single statement — there is no read-then-write window.
 *
 * A partial update touching only `arriveOn` can still violate the window against
 * the STORED `departOn`. Zod cannot see that, which is what makes the CHECK
 * constraint catch below load-bearing rather than defensive.
 */
export async function updateDestination(
  weddingId: string,
  destinationId: string,
  input: UpdateDestinationInput,
): Promise<WeddingDestination> {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.city         !== undefined) patch['city']         = input.city;
  if (input.countryCode  !== undefined) patch['countryCode']  = input.countryCode;
  if (input.ianaTimezone !== undefined) patch['ianaTimezone'] = input.ianaTimezone;
  if (input.arriveOn     !== undefined) patch['arriveOn']     = input.arriveOn;
  if (input.departOn     !== undefined) patch['departOn']     = input.departOn;
  if (input.sortOrder    !== undefined) patch['sortOrder']    = input.sortOrder;
  if (input.notes        !== undefined) patch['notes']        = input.notes;

  // isPrimary is deliberately NOT settable here — moving the flag needs the
  // clear-then-set transaction in setPrimaryDestination. Honouring it here would
  // collide with the unique index for no benefit.

  try {
    const [updated] = await db
      .update(weddingDestinations)
      .set(patch)
      .where(and(
        eq(weddingDestinations.id, destinationId),
        eq(weddingDestinations.weddingId, weddingId),
      ))
      .returning();
    if (!updated) throw new DestinationError('NOT_FOUND', 'Destination not found');
    return serializeDestination(updated);
  } catch (e) {
    if (e instanceof DestinationError) throw e;
    return rethrowConstraint(e);
  }
}

/**
 * Delete a leg.
 *
 * Ceremonies DETACH rather than disappear (`ON DELETE SET NULL`, migration 0036)
 * — losing a ceremony because a city changed would be data loss nobody asked
 * for. The count is taken before the delete so the caller can tell the planner
 * what happened. That leg's travel rows do cascade, since an itinerary to a
 * dropped city is meaningless.
 */
export async function deleteDestination(
  weddingId: string,
  destinationId: string,
): Promise<DestinationDeleteResult> {
  await loadLeg(weddingId, destinationId);

  return db.transaction(async (tx) => {
    const countRows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(ceremonies)
      .where(and(
        eq(ceremonies.destinationId, destinationId),
        eq(ceremonies.weddingId, weddingId),
      ));
    const detached = Number(countRows[0]?.n ?? 0);

    await tx
      .delete(weddingDestinations)
      .where(and(
        eq(weddingDestinations.id, destinationId),
        eq(weddingDestinations.weddingId, weddingId),
      ));

    return { id: destinationId, detachedCeremonies: detached };
  });
}

/** Move the primary flag. Clear-then-set inside one transaction. */
export async function setPrimaryDestination(
  weddingId: string,
  destinationId: string,
): Promise<WeddingDestination> {
  await loadLeg(weddingId, destinationId);

  try {
    return await db.transaction(async (tx) => {
      await tx
        .update(weddingDestinations)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(
          eq(weddingDestinations.weddingId, weddingId),
          eq(weddingDestinations.isPrimary, true),
        ));

      const [updated] = await tx
        .update(weddingDestinations)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(and(
          eq(weddingDestinations.id, destinationId),
          eq(weddingDestinations.weddingId, weddingId),
        ))
        .returning();
      if (!updated) throw new DestinationError('NOT_FOUND', 'Destination not found');
      return serializeDestination(updated);
    });
  } catch (e) {
    if (e instanceof DestinationError) throw e;
    return rethrowConstraint(e);
  }
}

/**
 * Reorder legs.
 *
 * Every submitted id is verified against the wedding BEFORE any write, inside the
 * transaction. A list containing one foreign id therefore changes nothing at all
 * rather than applying the valid prefix and then failing — a half-applied reorder
 * is worse than a rejected one.
 */
export async function reorderDestinations(
  weddingId: string,
  input: ReorderDestinationsInput,
): Promise<DestinationSummary[]> {
  const ids = input.order.map((o) => o.id);
  if (new Set(ids).size !== ids.length) {
    throw new DestinationError('VALIDATION_ERROR', 'Duplicate destination id in order');
  }

  await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: weddingDestinations.id })
      .from(weddingDestinations)
      .where(and(
        eq(weddingDestinations.weddingId, weddingId),
        inArray(weddingDestinations.id, ids),
      ));

    if (owned.length !== ids.length) {
      throw new DestinationError('NOT_FOUND', 'One or more destinations do not belong to this wedding');
    }

    for (const { id, sortOrder } of input.order) {
      await tx
        .update(weddingDestinations)
        .set({ sortOrder, updatedAt: new Date() })
        .where(and(
          eq(weddingDestinations.id, id),
          eq(weddingDestinations.weddingId, weddingId),
        ));
    }
  });

  return listDestinations(weddingId);
}

// ── Guest travel ─────────────────────────────────────────────────────────────

/**
 * Prove a guest belongs to THIS wedding.
 *
 * `guests` has no weddingId; it reaches the wedding only through
 * `guestLists.weddingId` (UNIQUE — one list per wedding). Without this join a
 * caller could attach any guest row in the database, from any other wedding, to
 * their own leg. This is the CLAUDE.md rule-12 trap in this module.
 */
async function assertGuestInWedding(weddingId: string, guestId: string): Promise<void> {
  const [row] = await db
    .select({ id: guests.id })
    .from(guests)
    .innerJoin(guestLists, eq(guestLists.id, guests.guestListId))
    .where(and(eq(guests.id, guestId), eq(guestLists.weddingId, weddingId)))
    .limit(1);
  if (!row) {
    throw new DestinationError('GUEST_NOT_IN_WEDDING', 'Guest does not belong to this wedding');
  }
}

/**
 * Create or update one guest's travel for one leg. Unique on
 * (destinationId, guestId), so a repeat call updates the itinerary rather than
 * stacking a second row for the same person.
 */
export async function upsertGuestTravelLeg(
  weddingId: string,
  destinationId: string,
  input: UpsertGuestTravelLegInput,
): Promise<GuestTravelLegWithGuest> {
  await loadLeg(weddingId, destinationId);
  await assertGuestInWedding(weddingId, input.guestId);

  const values = {
    destinationId,
    guestId:       input.guestId,
    arrivalDate:   input.arrivalDate   ?? null,
    arrivalTime:   input.arrivalTime   ?? null,
    departureDate: input.departureDate ?? null,
    departureTime: input.departureTime ?? null,
    travelNotes:   input.travelNotes   ?? null,
  };

  const [row] = await db
    .insert(guestTravelLegs)
    .values(values)
    .onConflictDoUpdate({
      target: [guestTravelLegs.destinationId, guestTravelLegs.guestId],
      set: {
        arrivalDate:   values.arrivalDate,
        arrivalTime:   values.arrivalTime,
        departureDate: values.departureDate,
        departureTime: values.departureTime,
        travelNotes:   values.travelNotes,
        updatedAt:     new Date(),
      },
    })
    .returning();
  if (!row) throw new DestinationError('INTERNAL_ERROR', 'Upsert returned no row');

  const [g] = await db
    .select({ name: guests.name, side: guests.side })
    .from(guests)
    .where(eq(guests.id, input.guestId))
    .limit(1);

  return serializeTravelLeg(row, g?.name ?? '', g?.side ?? null);
}

export async function deleteGuestTravelLeg(
  weddingId: string,
  destinationId: string,
  legId: string,
): Promise<{ id: string }> {
  await loadLeg(weddingId, destinationId);

  const [deleted] = await db
    .delete(guestTravelLegs)
    .where(and(
      eq(guestTravelLegs.id, legId),
      eq(guestTravelLegs.destinationId, destinationId),
    ))
    .returning({ id: guestTravelLegs.id });

  if (!deleted) throw new DestinationError('NOT_FOUND', 'Travel record not found');
  return { id: deleted.id };
}
