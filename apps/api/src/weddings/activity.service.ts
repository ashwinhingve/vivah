/**
 * Smart Shaadi — Wedding activity log helper
 *
 * Append-only log of who did what on a wedding. Called by other services
 * to keep an audit trail. Failures are swallowed so they never block the
 * main mutation.
 */

import { eq, desc, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { weddingActivityLog, user } from '@smartshaadi/db';
import type { ActivityLogEntry } from '@smartshaadi/types';
import { requireRole } from './access.js';

export async function logActivity(
  weddingId: string,
  actorId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(weddingActivityLog).values({
      weddingId,
      actorId,
      action,
      entityType: entityType ?? null,
      entityId:   entityId ?? null,
      payload:    payload ?? null,
    });
  } catch (e) {
    console.warn('[activity] failed to log:', (e as Error).message);
  }
}

export async function getActivity(
  weddingId: string,
  userId: string,
  limit = 50,
): Promise<ActivityLogEntry[]> {
  await requireRole(weddingId, userId, 'VIEWER');

  const rows = await db
    .select({
      id:         weddingActivityLog.id,
      weddingId:  weddingActivityLog.weddingId,
      actorId:    weddingActivityLog.actorId,
      actorName:  user.name,
      action:     weddingActivityLog.action,
      entityType: weddingActivityLog.entityType,
      entityId:   weddingActivityLog.entityId,
      payload:    weddingActivityLog.payload,
      createdAt:  weddingActivityLog.createdAt,
    })
    .from(weddingActivityLog)
    .leftJoin(user, eq(user.id, weddingActivityLog.actorId))
    .where(eq(weddingActivityLog.weddingId, weddingId))
    .orderBy(desc(weddingActivityLog.createdAt))
    .limit(Math.min(limit, 200));

  return rows.map((r): ActivityLogEntry => ({
    id:         r.id,
    weddingId:  r.weddingId,
    actorId:    r.actorId,
    actorName:  r.actorName ?? null,
    action:     r.action,
    entityType: r.entityType,
    entityId:   r.entityId,
    payload:    (r.payload as Record<string, unknown> | null),
    createdAt:  r.createdAt.toISOString(),
  }));
}

// Avoid unused import lint
void and;
