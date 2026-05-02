/**
 * Smart Shaadi — Wedding reminders
 *
 * Seeds a cascading reminder chain (T-30d, T-7d, T-1d, T-1h) when a ceremony
 * date is set/changed. The wedding-reminder BullMQ worker dispatches them
 * via the notifications + invitations channels.
 */

import { eq, and, isNull, lte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { weddingReminders, ceremonies } from '@smartshaadi/db';
import type { CeremonyReminder } from '@smartshaadi/types';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';

const CHAIN: Array<{ type: 'CEREMONY_T_30D' | 'CEREMONY_T_7D' | 'CEREMONY_T_1D' | 'CEREMONY_T_1H'; offsetMs: number }> = [
  { type: 'CEREMONY_T_30D', offsetMs: 30 * 24 * 60 * 60 * 1000 },
  { type: 'CEREMONY_T_7D',  offsetMs: 7 * 24 * 60 * 60 * 1000 },
  { type: 'CEREMONY_T_1D',  offsetMs: 1 * 24 * 60 * 60 * 1000 },
  { type: 'CEREMONY_T_1H',  offsetMs: 60 * 60 * 1000 },
];

function toReminder(r: typeof weddingReminders.$inferSelect): CeremonyReminder {
  return {
    id:           r.id,
    weddingId:    r.weddingId,
    ceremonyId:   r.ceremonyId,
    type:         r.type,
    channel:      r.channel,
    scheduledAt:  r.scheduledAt.toISOString(),
    sentAt:       r.sentAt?.toISOString() ?? null,
    failedAt:     r.failedAt?.toISOString() ?? null,
    attemptCount: r.attemptCount,
  };
}

/**
 * Seed (or re-seed) the cascading reminder chain for a single ceremony.
 * Existing unsent reminders for that (ceremonyId, type) are deleted first
 * so a date change moves the schedule cleanly.
 */
export async function seedCeremonyReminderChain(
  weddingId: string,
  ceremonyId: string,
  startTimeIso: string,
): Promise<CeremonyReminder[]> {
  const start = new Date(startTimeIso);
  if (Number.isNaN(start.getTime())) return [];

  // Wipe future unsent reminders for this ceremony (safe: keeps sent history)
  await db.delete(weddingReminders).where(and(
    eq(weddingReminders.weddingId, weddingId),
    eq(weddingReminders.ceremonyId, ceremonyId),
    isNull(weddingReminders.sentAt),
  ));

  const now = Date.now();
  const rows = CHAIN
    .map((c) => ({
      type:        c.type,
      scheduledAt: new Date(start.getTime() - c.offsetMs),
    }))
    .filter((r) => r.scheduledAt.getTime() > now)
    .map((r) => ({
      weddingId,
      ceremonyId,
      type:        r.type,
      channel:     'IN_APP',
      scheduledAt: r.scheduledAt,
      payload:     { ceremonyId },
    }));

  if (rows.length === 0) return [];

  const inserted = await db.insert(weddingReminders).values(rows).returning();
  return inserted.map(toReminder);
}

/** Worker: claim due reminders to dispatch. */
export async function fetchDueReminders(limit = 50): Promise<CeremonyReminder[]> {
  const rows = await db
    .select()
    .from(weddingReminders)
    .where(and(
      isNull(weddingReminders.sentAt),
      isNull(weddingReminders.failedAt),
      lte(weddingReminders.scheduledAt, new Date()),
    ))
    .limit(limit);
  return rows.map(toReminder);
}

export async function markReminderSent(id: string): Promise<void> {
  await db.update(weddingReminders)
    .set({ sentAt: new Date() })
    .where(eq(weddingReminders.id, id));
}

export async function markReminderFailed(id: string): Promise<void> {
  await db.update(weddingReminders)
    .set({ failedAt: new Date(), attemptCount: 1 })
    .where(eq(weddingReminders.id, id));
}

export async function listReminders(
  weddingId: string,
  userId: string,
): Promise<CeremonyReminder[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  const rows = await db
    .select()
    .from(weddingReminders)
    .where(eq(weddingReminders.weddingId, weddingId));
  return rows.map(toReminder);
}

void logActivity;  // reserved for future per-reminder dispatch logging

/** Helper: detect ceremony schedule conflicts within a wedding. */
export async function detectCeremonyConflicts(
  weddingId: string,
  date: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  excludeCeremonyId?: string,
): Promise<Array<{ id: string; type: string; date: string | null; startTime: string | null; endTime: string | null }>> {
  if (!startTime) return [];

  const rows = await db
    .select({
      id:        ceremonies.id,
      type:      ceremonies.type,
      date:      ceremonies.date,
      startTime: ceremonies.startTime,
      endTime:   ceremonies.endTime,
    })
    .from(ceremonies)
    .where(eq(ceremonies.weddingId, weddingId));

  const overlaps = rows.filter((c) => {
    if (excludeCeremonyId && c.id === excludeCeremonyId) return false;
    if (c.date !== date) return false;
    if (!c.startTime) return false;
    const [aStart, aEnd] = [toMin(startTime), toMin(endTime ?? startTime)];
    const [bStart, bEnd] = [toMin(c.startTime), toMin(c.endTime ?? c.startTime)];
    return aStart < bEnd && bStart < aEnd;
  });

  return overlaps;
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
