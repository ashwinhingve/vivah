/**
 * Smart Shaadi — Coordinator assignments
 *
 * Owner assigns a system-level EVENT_COORDINATOR user to a wedding.
 * Coordinator gains access via getWeddingRole() lookup.
 */

import { eq, and, isNull, sql, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  weddingCoordinatorAssignments,
  weddings,
  ceremonies,
  weddingTasks,
  weddingIncidents,
  user as userTable,
} from '@smartshaadi/db';
import type {
  CoordinatorAssignment,
  CoordinatorScope,
  ManagedWeddingSummary,
  CoordinatorTaskInboxItem,
  IncidentSeverity,
} from '@smartshaadi/types';
import type { AssignCoordinatorInput } from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';
import { queueNotification } from '../infrastructure/redis/queues.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

function toAssignment(r: typeof weddingCoordinatorAssignments.$inferSelect): CoordinatorAssignment {
  return {
    id:                r.id,
    weddingId:         r.weddingId,
    coordinatorUserId: r.coordinatorUserId,
    scope:             r.scope as CoordinatorScope,
    assignedBy:        r.assignedBy,
    assignedAt:        r.assignedAt.toISOString(),
    revokedAt:         r.revokedAt?.toISOString() ?? null,
    notes:             r.notes,
  };
}

export async function assignCoordinator(
  weddingId: string,
  actorUserId: string,
  input: AssignCoordinatorInput,
): Promise<CoordinatorAssignment> {
  await requireRole(weddingId, actorUserId, 'OWNER');

  const [target] = await db
    .select({ id: userTable.id, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, input.coordinatorUserId))
    .limit(1);
  if (!target) throw appErr('Coordinator user not found', 'NOT_FOUND', 404);
  if (target.role !== 'EVENT_COORDINATOR' && target.role !== 'ADMIN') {
    throw appErr('User is not a coordinator', 'BAD_ROLE', 400);
  }

  const [existing] = await db
    .select()
    .from(weddingCoordinatorAssignments)
    .where(and(
      eq(weddingCoordinatorAssignments.weddingId, weddingId),
      eq(weddingCoordinatorAssignments.coordinatorUserId, input.coordinatorUserId),
    ))
    .limit(1);

  if (existing && !existing.revokedAt) {
    throw appErr('Coordinator already assigned', 'CONFLICT', 409);
  }

  let row;
  if (existing) {
    [row] = await db
      .update(weddingCoordinatorAssignments)
      .set({
        scope:      input.scope,
        notes:      input.notes ?? null,
        assignedBy: actorUserId,
        assignedAt: new Date(),
        revokedAt:  null,
      })
      .where(eq(weddingCoordinatorAssignments.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(weddingCoordinatorAssignments)
      .values({
        weddingId,
        coordinatorUserId: input.coordinatorUserId,
        scope:             input.scope,
        notes:             input.notes ?? null,
        assignedBy:        actorUserId,
      })
      .returning();
  }

  if (!row) throw appErr('Failed to assign', 'INTERNAL', 500);

  await logActivity(
    weddingId,
    actorUserId,
    'COORDINATOR_ASSIGNED',
    'coordinator',
    input.coordinatorUserId,
    { scope: input.scope },
  );

  // Notify the new coordinator (best-effort)
  try {
    await queueNotification({
      userId:  input.coordinatorUserId,
      type:    'COORDINATOR_ASSIGNED',
      payload: { weddingId, scope: input.scope, assignedBy: actorUserId },
    });
  } catch { /* notification failure is non-fatal */ }

  return toAssignment(row);
}

export async function revokeCoordinator(
  weddingId: string,
  actorUserId: string,
  coordinatorUserId: string,
): Promise<void> {
  await requireRole(weddingId, actorUserId, 'OWNER');

  const [existing] = await db
    .select()
    .from(weddingCoordinatorAssignments)
    .where(and(
      eq(weddingCoordinatorAssignments.weddingId, weddingId),
      eq(weddingCoordinatorAssignments.coordinatorUserId, coordinatorUserId),
      isNull(weddingCoordinatorAssignments.revokedAt),
    ))
    .limit(1);

  if (!existing) throw appErr('Coordinator not assigned', 'NOT_FOUND', 404);

  await db
    .update(weddingCoordinatorAssignments)
    .set({ revokedAt: new Date() })
    .where(eq(weddingCoordinatorAssignments.id, existing.id));

  await logActivity(
    weddingId,
    actorUserId,
    'COORDINATOR_REVOKED',
    'coordinator',
    coordinatorUserId,
  );
}

export async function listCoordinatorsForWedding(
  weddingId: string,
  userId: string,
): Promise<Array<CoordinatorAssignment & { name: string | null; email: string | null }>> {
  await requireRole(weddingId, userId, 'VIEWER');

  const rows = await db
    .select({
      assign: weddingCoordinatorAssignments,
      name:   userTable.name,
      email:  userTable.email,
    })
    .from(weddingCoordinatorAssignments)
    .leftJoin(userTable, eq(userTable.id, weddingCoordinatorAssignments.coordinatorUserId))
    .where(and(
      eq(weddingCoordinatorAssignments.weddingId, weddingId),
      isNull(weddingCoordinatorAssignments.revokedAt),
    ));

  return rows.map((r) => ({ ...toAssignment(r.assign), name: r.name, email: r.email }));
}

/**
 * Resolves the set of weddings a user actively coordinates. Shared by
 * listMyManagedWeddings and listMyOpenTasksAndIncidents so both endpoints
 * apply the same role + assignment gate.
 */
async function getManagedWeddingIds(
  userId: string,
): Promise<{ ids: string[]; scopeByWedding: Map<string, CoordinatorScope> }> {
  const [u] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  const none = { ids: [], scopeByWedding: new Map<string, CoordinatorScope>() };
  if (!u) return none;
  if (u.role !== 'EVENT_COORDINATOR' && u.role !== 'ADMIN') return none;

  const assignments = await db
    .select({
      weddingId: weddingCoordinatorAssignments.weddingId,
      scope:     weddingCoordinatorAssignments.scope,
    })
    .from(weddingCoordinatorAssignments)
    .where(and(
      eq(weddingCoordinatorAssignments.coordinatorUserId, userId),
      isNull(weddingCoordinatorAssignments.revokedAt),
    ));

  return {
    ids:            assignments.map((a) => a.weddingId),
    scopeByWedding: new Map(assignments.map((a) => [a.weddingId, a.scope as CoordinatorScope])),
  };
}

export async function listMyManagedWeddings(userId: string): Promise<ManagedWeddingSummary[]> {
  const { ids, scopeByWedding } = await getManagedWeddingIds(userId);
  if (ids.length === 0) return [];

  const weddingRows = await db
    .select({
      id:          weddings.id,
      title:       weddings.title,
      weddingDate: weddings.weddingDate,
    })
    .from(weddings)
    .where(sql`${weddings.id} IN ${ids}`);

  const summaries: ManagedWeddingSummary[] = [];
  for (const w of weddingRows) {
    const ceremonyRows = await db
      .select({
        id:     ceremonies.id,
        type:   ceremonies.type,
        date:   ceremonies.date,
        status: ceremonies.status,
      })
      .from(ceremonies)
      .where(eq(ceremonies.weddingId, w.id));

    const sortedFuture = ceremonyRows
      .filter((c) => c.status === 'SCHEDULED' || c.status === 'IN_PROGRESS')
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    const next = sortedFuture[0] ?? null;

    const tasksRows = await db
      .select({ openTasks: count() })
      .from(weddingTasks)
      .where(and(eq(weddingTasks.weddingId, w.id), sql`${weddingTasks.status} IN ('TODO', 'IN_PROGRESS', 'BLOCKED')`));
    const openTasks = tasksRows[0]?.openTasks ?? 0;

    const incidentsRows = await db
      .select({ openIncidents: count() })
      .from(weddingIncidents)
      .where(and(eq(weddingIncidents.weddingId, w.id), isNull(weddingIncidents.resolvedAt)));
    const openIncidents = incidentsRows[0]?.openIncidents ?? 0;

    const daysUntil = w.weddingDate
      ? Math.ceil((new Date(w.weddingDate as unknown as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    summaries.push({
      weddingId:       w.id,
      title:           w.title ?? 'Wedding',
      weddingDate:     (w.weddingDate as unknown as string | null) ?? null,
      daysUntil,
      ceremoniesCount: ceremonyRows.length,
      nextCeremony:    next ? {
        id:     next.id,
        type:   next.type as ManagedWeddingSummary['nextCeremony'] extends infer T ? T extends { type: infer U } ? U : never : never,
        date:   (next.date as unknown as string | null) ?? null,
        status: next.status as ManagedWeddingSummary['nextCeremony'] extends infer T ? T extends { status: infer U } ? U : never : never,
      } : null,
      openTasks:    Number(openTasks ?? 0),
      openIncidents: Number(openIncidents ?? 0),
      scope:        scopeByWedding.get(w.id) ?? 'FULL',
    });
  }

  return summaries.sort((a, b) => {
    if (a.daysUntil === null) return 1;
    if (b.daysUntil === null) return -1;
    return a.daysUntil - b.daysUntil;
  });
}

const SEVERITY_RANK: Record<IncidentSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Orders the inbox so the most urgent items surface first: CRITICAL/HIGH
 * incidents lead, then anything with a due date (overdue sorts earliest
 * automatically), then remaining incidents by severity, then everything else.
 */
function inboxSortKey(item: CoordinatorTaskInboxItem): [number, number, string] {
  if (item.kind === 'INCIDENT' && item.severity && SEVERITY_RANK[item.severity] <= 1) {
    return [0, SEVERITY_RANK[item.severity], item.title];
  }
  if (item.dueDate) {
    return [1, new Date(item.dueDate).getTime(), item.title];
  }
  if (item.kind === 'INCIDENT' && item.severity) {
    return [2, SEVERITY_RANK[item.severity], item.title];
  }
  return [3, 0, item.title];
}

/**
 * Aggregates open tasks + unresolved incidents across every wedding a
 * coordinator manages into a single, urgency-sorted inbox. Reuses the same
 * status/resolved filters as listMyManagedWeddings' per-wedding counts.
 */
export async function listMyOpenTasksAndIncidents(userId: string): Promise<CoordinatorTaskInboxItem[]> {
  const { ids } = await getManagedWeddingIds(userId);
  if (ids.length === 0) return [];

  const weddingRows = await db
    .select({ id: weddings.id, title: weddings.title })
    .from(weddings)
    .where(sql`${weddings.id} IN ${ids}`);
  const titleByWedding = new Map(weddingRows.map((w) => [w.id, w.title ?? 'Wedding']));

  const taskRows = await db
    .select({
      id:        weddingTasks.id,
      weddingId: weddingTasks.weddingId,
      title:     weddingTasks.title,
      dueDate:   weddingTasks.dueDate,
      status:    weddingTasks.status,
    })
    .from(weddingTasks)
    .where(and(
      sql`${weddingTasks.weddingId} IN ${ids}`,
      sql`${weddingTasks.status} IN ('TODO', 'IN_PROGRESS', 'BLOCKED')`,
    ));

  const incidentRows = await db
    .select({
      id:        weddingIncidents.id,
      weddingId: weddingIncidents.weddingId,
      title:     weddingIncidents.title,
      severity:  weddingIncidents.severity,
    })
    .from(weddingIncidents)
    .where(and(
      sql`${weddingIncidents.weddingId} IN ${ids}`,
      isNull(weddingIncidents.resolvedAt),
    ));

  const items: CoordinatorTaskInboxItem[] = [
    ...taskRows.map((t): CoordinatorTaskInboxItem => ({
      weddingId:    t.weddingId,
      weddingTitle: titleByWedding.get(t.weddingId) ?? 'Wedding',
      kind:         'TASK',
      id:           t.id,
      title:        t.title,
      dueDate:      (t.dueDate as unknown as string | null) ?? null,
      severity:     null,
      status:       t.status,
    })),
    ...incidentRows.map((i): CoordinatorTaskInboxItem => ({
      weddingId:    i.weddingId,
      weddingTitle: titleByWedding.get(i.weddingId) ?? 'Wedding',
      kind:         'INCIDENT',
      id:           i.id,
      title:        i.title,
      dueDate:      null,
      severity:     i.severity as IncidentSeverity,
      status:       null,
    })),
  ];

  return items.sort((a, b) => {
    const ka = inboxSortKey(a);
    const kb = inboxSortKey(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
  });
}
