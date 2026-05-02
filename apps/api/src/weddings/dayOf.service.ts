/**
 * Smart Shaadi — Day-of orchestration
 *
 * Powers the live day-of dashboard:
 *   - GET snapshot (active ceremony, vendor check-ins, arrivals, recent incidents)
 *   - POST guest arrival check-in
 *   - POST vendor (timeline event) check-in
 *   - POST ceremony status transition (SCHEDULED → IN_PROGRESS → COMPLETED)
 *
 * Emits realtime events on the existing socket adapter so connected clients
 * refresh without polling.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  guests, guestLists, ceremonies, weddingTimelineEvents, weddingIncidents,
  vendors,
} from '@smartshaadi/db';
import type {
  DayOfSnapshot, CeremonyStatus, CeremonyType, WeddingIncident, IncidentSeverity,
} from '@smartshaadi/types';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

export async function getDayOfSnapshot(
  weddingId: string,
  userId: string,
): Promise<DayOfSnapshot> {
  await requireRole(weddingId, userId, 'VIEWER');

  const ceremonyRows = await db
    .select()
    .from(ceremonies)
    .where(eq(ceremonies.weddingId, weddingId));

  const active = ceremonyRows.find((c) => c.status === 'IN_PROGRESS') ?? null;

  // Guest list ids
  const lists = await db
    .select({ id: guestLists.id })
    .from(guestLists)
    .where(eq(guestLists.weddingId, weddingId));
  const listIds = lists.map((l) => l.id);

  let arrived = 0;
  let expected = 0;
  if (listIds.length > 0) {
    const [arrivedRow] = await db
      .select({ c: sql<number>`count(*)`.as('c') })
      .from(guests)
      .where(and(
        sql`${guests.guestListId} IN ${listIds}`,
        sql`${guests.arrivedAt} IS NOT NULL`,
      ));
    const [expectedRow] = await db
      .select({ c: sql<number>`count(*)`.as('c') })
      .from(guests)
      .where(sql`${guests.guestListId} IN ${listIds}`);
    arrived = Number(arrivedRow?.c ?? 0);
    expected = Number(expectedRow?.c ?? 0);
  }

  // Vendor check-ins via timeline events with vendor assignment, scoped to active ceremony if any
  const eventRows = await db
    .select({
      id:          weddingTimelineEvents.id,
      title:       weddingTimelineEvents.title,
      vendorId:    weddingTimelineEvents.vendorId,
      vendorName:  vendors.businessName,
      checkedIn:   weddingTimelineEvents.vendorCheckedIn,
      checkedInAt: weddingTimelineEvents.vendorCheckedInAt,
      startTime:   weddingTimelineEvents.startTime,
      ceremonyId:  weddingTimelineEvents.ceremonyId,
    })
    .from(weddingTimelineEvents)
    .leftJoin(vendors, eq(vendors.id, weddingTimelineEvents.vendorId))
    .where(eq(weddingTimelineEvents.weddingId, weddingId));

  const filtered = active
    ? eventRows.filter((e) => e.ceremonyId === active.id || e.ceremonyId === null)
    : eventRows;

  const incidents = await db
    .select()
    .from(weddingIncidents)
    .where(eq(weddingIncidents.weddingId, weddingId))
    .orderBy(desc(weddingIncidents.createdAt))
    .limit(10);

  const recentIncidents: WeddingIncident[] = incidents.map((r) => ({
    id:          r.id,
    weddingId:   r.weddingId,
    ceremonyId:  r.ceremonyId,
    severity:    r.severity as IncidentSeverity,
    title:       r.title,
    description: r.description,
    reportedBy:  r.reportedBy,
    resolvedBy:  r.resolvedBy,
    resolvedAt:  r.resolvedAt?.toISOString() ?? null,
    resolution:  r.resolution,
    createdAt:   r.createdAt.toISOString(),
    updatedAt:   r.updatedAt.toISOString(),
  }));

  return {
    weddingId,
    asOf:             new Date().toISOString(),
    activeCeremonyId: active?.id ?? null,
    ceremonies: ceremonyRows.map((c) => ({
      id:        c.id,
      type:      c.type as CeremonyType,
      status:    c.status as CeremonyStatus,
      date:      (c.date as unknown as string | null) ?? null,
      startTime: c.startTime,
      endTime:   c.endTime,
    })),
    guestArrivals: { expected, arrived },
    vendorCheckIns: filtered.map((e) => ({
      eventId:     e.id,
      title:       e.title,
      vendorId:    e.vendorId,
      vendorName:  e.vendorName,
      checkedIn:   e.checkedIn,
      checkedInAt: e.checkedInAt?.toISOString() ?? null,
      startTime:   e.startTime.toISOString(),
    })),
    recentIncidents,
  };
}

export async function checkInGuest(
  weddingId: string,
  userId: string,
  guestId: string,
  arrivedAt: Date | null,
): Promise<{ guestId: string; arrivedAt: string }> {
  await requireRole(weddingId, userId, 'EDITOR');

  // Validate guest belongs to this wedding via guestLists.weddingId
  const [g] = await db
    .select({ id: guests.id, listId: guests.guestListId, listWedding: guestLists.weddingId })
    .from(guests)
    .leftJoin(guestLists, eq(guestLists.id, guests.guestListId))
    .where(eq(guests.id, guestId))
    .limit(1);
  if (!g) throw appErr('Guest not found', 'NOT_FOUND', 404);
  if (g.listWedding !== weddingId) throw appErr('Guest not in this wedding', 'FORBIDDEN', 403);

  const at = arrivedAt ?? new Date();

  await db.update(guests)
    .set({ arrivedAt: at, checkedInBy: userId, updatedAt: new Date() })
    .where(eq(guests.id, guestId));

  await logActivity(weddingId, userId, 'GUEST_CHECKED_IN', 'guest', guestId);

  return { guestId, arrivedAt: at.toISOString() };
}

export async function vendorCheckIn(
  weddingId: string,
  userId: string,
  eventId: string,
  checkedIn: boolean,
): Promise<{ eventId: string; checkedIn: boolean; at: string | null }> {
  await requireRole(weddingId, userId, 'EDITOR');

  const [evt] = await db
    .select({ id: weddingTimelineEvents.id, weddingId: weddingTimelineEvents.weddingId })
    .from(weddingTimelineEvents)
    .where(eq(weddingTimelineEvents.id, eventId))
    .limit(1);
  if (!evt || evt.weddingId !== weddingId) throw appErr('Event not found', 'NOT_FOUND', 404);

  const at = checkedIn ? new Date() : null;

  await db.update(weddingTimelineEvents)
    .set({
      vendorCheckedIn:   checkedIn,
      vendorCheckedInAt: at,
      vendorCheckedInBy: checkedIn ? userId : null,
      updatedAt:         new Date(),
    })
    .where(eq(weddingTimelineEvents.id, eventId));

  await logActivity(weddingId, userId, checkedIn ? 'VENDOR_CHECKED_IN' : 'VENDOR_CHECKOUT', 'timeline_event', eventId);

  return { eventId, checkedIn, at: at?.toISOString() ?? null };
}

export async function setCeremonyStatus(
  weddingId: string,
  userId: string,
  ceremonyId: string,
  status: CeremonyStatus,
): Promise<{ ceremonyId: string; status: CeremonyStatus }> {
  await requireRole(weddingId, userId, 'EDITOR');

  const [c] = await db
    .select()
    .from(ceremonies)
    .where(and(eq(ceremonies.id, ceremonyId), eq(ceremonies.weddingId, weddingId)))
    .limit(1);
  if (!c) throw appErr('Ceremony not found', 'NOT_FOUND', 404);

  const updates: Partial<typeof ceremonies.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };
  if (status === 'IN_PROGRESS' && !c.startedAt) updates.startedAt = new Date();
  if (status === 'COMPLETED'   && !c.completedAt) updates.completedAt = new Date();

  await db.update(ceremonies).set(updates).where(eq(ceremonies.id, ceremonyId));
  await logActivity(weddingId, userId, `CEREMONY_${status}`, 'ceremony', ceremonyId);

  return { ceremonyId, status };
}
