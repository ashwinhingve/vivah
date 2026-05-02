/**
 * Smart Shaadi — Day-of timeline (schedule of events with assigned roles)
 */

import { eq, and, asc, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { weddingTimelineEvents, ceremonies } from '@smartshaadi/db';
import type { TimelineEvent } from '@smartshaadi/types';
import type {
  CreateTimelineEventInput,
  UpdateTimelineEventInput,
  ReorderTimelineInput,
} from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';

type Row = typeof weddingTimelineEvents.$inferSelect;

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

function toDto(r: Row): TimelineEvent {
  return {
    id:          r.id,
    weddingId:   r.weddingId,
    ceremonyId:  r.ceremonyId,
    title:       r.title,
    description: r.description,
    startTime:   r.startTime.toISOString(),
    endTime:     r.endTime ? r.endTime.toISOString() : null,
    location:    r.location,
    assignedTo:  r.assignedTo,
    vendorId:    r.vendorId,
    sortOrder:   r.sortOrder,
  };
}

export async function listTimeline(weddingId: string, userId: string): Promise<TimelineEvent[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  const rows = await db
    .select()
    .from(weddingTimelineEvents)
    .where(eq(weddingTimelineEvents.weddingId, weddingId))
    .orderBy(asc(weddingTimelineEvents.startTime), asc(weddingTimelineEvents.sortOrder));
  return rows.map(toDto);
}

export async function createEvent(
  weddingId: string,
  userId: string,
  input: CreateTimelineEventInput,
): Promise<TimelineEvent> {
  await requireRole(weddingId, userId, 'EDITOR');

  if (input.endTime && new Date(input.endTime) <= new Date(input.startTime)) {
    throw appErr('endTime must be after startTime', 'VALIDATION_ERROR', 400);
  }

  const [row] = await db
    .insert(weddingTimelineEvents)
    .values({
      weddingId,
      ceremonyId:  input.ceremonyId ?? null,
      title:       input.title,
      description: input.description ?? null,
      startTime:   new Date(input.startTime),
      endTime:     input.endTime ? new Date(input.endTime) : null,
      location:    input.location ?? null,
      assignedTo:  input.assignedTo ?? null,
      vendorId:    input.vendorId ?? null,
      sortOrder:   input.sortOrder ?? 0,
    })
    .returning();

  if (!row) throw appErr('Failed to create event', 'EVENT_CREATE_FAILED', 500);
  await logActivity(weddingId, userId, 'timeline.create', 'timelineEvent', row.id, { title: row.title });
  return toDto(row);
}

export async function updateEvent(
  weddingId: string,
  userId: string,
  eventId: string,
  input: UpdateTimelineEventInput,
): Promise<TimelineEvent> {
  await requireRole(weddingId, userId, 'EDITOR');

  const updates: Partial<typeof weddingTimelineEvents.$inferInsert> = { updatedAt: new Date() };
  if (input.ceremonyId  !== undefined) updates.ceremonyId  = input.ceremonyId ?? null;
  if (input.title       !== undefined) updates.title       = input.title;
  if (input.description !== undefined) updates.description = input.description ?? null;
  if (input.startTime   !== undefined) updates.startTime   = new Date(input.startTime);
  if (input.endTime     !== undefined) updates.endTime     = input.endTime ? new Date(input.endTime) : null;
  if (input.location    !== undefined) updates.location    = input.location ?? null;
  if (input.assignedTo  !== undefined) updates.assignedTo  = input.assignedTo ?? null;
  if (input.vendorId    !== undefined) updates.vendorId    = input.vendorId ?? null;
  if (input.sortOrder   !== undefined) updates.sortOrder   = input.sortOrder;

  const [row] = await db
    .update(weddingTimelineEvents)
    .set(updates)
    .where(and(eq(weddingTimelineEvents.id, eventId), eq(weddingTimelineEvents.weddingId, weddingId)))
    .returning();

  if (!row) throw appErr('Event not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'timeline.update', 'timelineEvent', eventId);
  return toDto(row);
}

export async function deleteEvent(
  weddingId: string,
  userId: string,
  eventId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  const deleted = await db
    .delete(weddingTimelineEvents)
    .where(and(eq(weddingTimelineEvents.id, eventId), eq(weddingTimelineEvents.weddingId, weddingId)))
    .returning({ id: weddingTimelineEvents.id });
  if (deleted.length === 0) throw appErr('Event not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'timeline.delete', 'timelineEvent', eventId);
}

export async function reorderTimeline(
  weddingId: string,
  userId: string,
  input: ReorderTimelineInput,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');

  const ids = input.order.map(o => o.id);
  const owned = await db
    .select({ id: weddingTimelineEvents.id })
    .from(weddingTimelineEvents)
    .where(and(eq(weddingTimelineEvents.weddingId, weddingId), inArray(weddingTimelineEvents.id, ids)));
  if (owned.length !== ids.length) throw appErr('Some events not in this wedding', 'FORBIDDEN', 403);

  for (const o of input.order) {
    await db
      .update(weddingTimelineEvents)
      .set({ sortOrder: o.sortOrder, updatedAt: new Date() })
      .where(eq(weddingTimelineEvents.id, o.id));
  }
  await logActivity(weddingId, userId, 'timeline.reorder');
}

// ── auto-generate from ceremonies ────────────────────────────────────────────

const DEFAULT_TEMPLATE: Record<string, Array<{ title: string; offsetMin: number; durationMin: number }>> = {
  HALDI:    [
    { title: 'Mandap setup',          offsetMin: -120, durationMin: 60 },
    { title: 'Bride/Groom prep',      offsetMin: -45,  durationMin: 30 },
    { title: 'Haldi ritual',          offsetMin: 0,    durationMin: 60 },
    { title: 'Group photos',          offsetMin: 60,   durationMin: 30 },
    { title: 'Lunch',                 offsetMin: 90,   durationMin: 60 },
  ],
  MEHNDI:   [
    { title: 'Mehndi artists arrive', offsetMin: -45,  durationMin: 30 },
    { title: 'Bride mehndi starts',   offsetMin: 0,    durationMin: 180 },
    { title: 'Family mehndi',         offsetMin: 30,   durationMin: 120 },
    { title: 'Sangeet rehearsal',     offsetMin: 180,  durationMin: 60 },
  ],
  SANGEET:  [
    { title: 'Decor + AV setup',      offsetMin: -180, durationMin: 90 },
    { title: 'Welcome drinks',        offsetMin: 0,    durationMin: 30 },
    { title: 'Dance performances',    offsetMin: 30,   durationMin: 90 },
    { title: 'Couple performance',    offsetMin: 120,  durationMin: 15 },
    { title: 'Open dance floor',      offsetMin: 135,  durationMin: 90 },
    { title: 'Dinner',                offsetMin: 165,  durationMin: 90 },
  ],
  WEDDING:  [
    { title: 'Mandap setup',          offsetMin: -240, durationMin: 120 },
    { title: 'Baraat / arrival',      offsetMin: -60,  durationMin: 45 },
    { title: 'Welcome / Milni',       offsetMin: -15,  durationMin: 20 },
    { title: 'Varmala',               offsetMin: 15,   durationMin: 15 },
    { title: 'Pheras',                offsetMin: 30,   durationMin: 60 },
    { title: 'Sindoor + Mangalsutra', offsetMin: 90,   durationMin: 15 },
    { title: 'Vidaai',                offsetMin: 120,  durationMin: 30 },
  ],
  RECEPTION: [
    { title: 'Couple entry',          offsetMin: 0,    durationMin: 15 },
    { title: 'Stage photos',          offsetMin: 15,   durationMin: 90 },
    { title: 'Cake cutting',          offsetMin: 105,  durationMin: 15 },
    { title: 'Speeches + toasts',     offsetMin: 120,  durationMin: 30 },
    { title: 'Dinner',                offsetMin: 150,  durationMin: 90 },
  ],
};

function parseHHMM(date: string, hhmm?: string | null): Date {
  if (!hhmm) return new Date(`${date}T09:00:00`);
  return new Date(`${date}T${hhmm}:00`);
}

export async function autoGenerateFromCeremonies(
  weddingId: string,
  userId: string,
): Promise<{ created: number }> {
  await requireRole(weddingId, userId, 'EDITOR');

  const cers = await db
    .select()
    .from(ceremonies)
    .where(eq(ceremonies.weddingId, weddingId));

  let created = 0;
  for (const c of cers) {
    if (!c.date) continue;
    const template = DEFAULT_TEMPLATE[c.type] ?? [];
    if (template.length === 0) continue;

    const anchor = parseHHMM(c.date, c.startTime);
    const values = template.map((t, idx) => {
      const start = new Date(anchor.getTime() + t.offsetMin * 60_000);
      const end   = new Date(start.getTime() + t.durationMin * 60_000);
      return {
        weddingId,
        ceremonyId: c.id,
        title:      t.title,
        startTime:  start,
        endTime:    end,
        location:   c.venue,
        sortOrder:  idx,
      };
    });
    if (values.length === 0) continue;
    const inserted = await db.insert(weddingTimelineEvents).values(values).returning({ id: weddingTimelineEvents.id });
    created += inserted.length;
  }

  await logActivity(weddingId, userId, 'timeline.auto_generate', undefined, undefined, { created });
  return { created };
}
