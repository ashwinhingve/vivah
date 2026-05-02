/**
 * Smart Shaadi — Day-of incident log
 *
 * Coordinators (and owners/editors) can raise + resolve incidents.
 * Severity drives the realtime + notification fan-out.
 */

import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { weddingIncidents } from '@smartshaadi/db';
import type { WeddingIncident, IncidentSeverity } from '@smartshaadi/types';
import type { CreateIncidentInput, ResolveIncidentInput } from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';
import { queueNotification } from '../infrastructure/redis/queues.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

function toIncident(r: typeof weddingIncidents.$inferSelect): WeddingIncident {
  return {
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
  };
}

export async function listIncidents(
  weddingId: string,
  userId: string,
  opts: { open?: boolean; severity?: IncidentSeverity } = {},
): Promise<WeddingIncident[]> {
  await requireRole(weddingId, userId, 'VIEWER');

  const conds = [eq(weddingIncidents.weddingId, weddingId)];
  if (opts.open) conds.push(isNull(weddingIncidents.resolvedAt));
  if (opts.severity) conds.push(eq(weddingIncidents.severity, opts.severity));

  const rows = await db
    .select()
    .from(weddingIncidents)
    .where(and(...conds))
    .orderBy(desc(weddingIncidents.createdAt));
  return rows.map(toIncident);
}

export async function createIncident(
  weddingId: string,
  userId: string,
  input: CreateIncidentInput,
): Promise<WeddingIncident> {
  await requireRole(weddingId, userId, 'EDITOR');

  const [row] = await db
    .insert(weddingIncidents)
    .values({
      weddingId,
      ceremonyId:  input.ceremonyId ?? null,
      severity:    input.severity,
      title:       input.title,
      description: input.description ?? null,
      reportedBy:  userId,
    })
    .returning();
  if (!row) throw appErr('Failed to create incident', 'INTERNAL', 500);

  await logActivity(weddingId, userId, 'INCIDENT_RAISED', 'incident', row.id, {
    severity: input.severity,
    title:    input.title,
  });

  // Fan-out: notify wedding owner + active coordinators (best-effort)
  try {
    await queueNotification({
      userId:  userId,  // self-notify confirmation; broader fan-out happens in dispatch worker
      type:    'INCIDENT_RAISED',
      payload: { weddingId, incidentId: row.id, severity: input.severity, title: input.title },
    });
  } catch { /* non-fatal */ }

  return toIncident(row);
}

export async function resolveIncident(
  weddingId: string,
  userId: string,
  incidentId: string,
  input: ResolveIncidentInput,
): Promise<WeddingIncident> {
  await requireRole(weddingId, userId, 'EDITOR');

  const [existing] = await db
    .select()
    .from(weddingIncidents)
    .where(and(eq(weddingIncidents.id, incidentId), eq(weddingIncidents.weddingId, weddingId)))
    .limit(1);
  if (!existing) throw appErr('Incident not found', 'NOT_FOUND', 404);
  if (existing.resolvedAt) throw appErr('Already resolved', 'ALREADY_RESOLVED', 409);

  const [row] = await db
    .update(weddingIncidents)
    .set({
      resolvedAt: new Date(),
      resolvedBy: userId,
      resolution: input.resolution,
      updatedAt:  new Date(),
    })
    .where(eq(weddingIncidents.id, incidentId))
    .returning();
  if (!row) throw appErr('Failed to resolve', 'INTERNAL', 500);

  await logActivity(weddingId, userId, 'INCIDENT_RESOLVED', 'incident', incidentId);

  return toIncident(row);
}

export async function getIncidentCount(weddingId: string): Promise<{ open: number; total: number }> {
  const openRows = await db
    .select({ open: sql<number>`count(*)`.as('open') })
    .from(weddingIncidents)
    .where(and(eq(weddingIncidents.weddingId, weddingId), isNull(weddingIncidents.resolvedAt)));
  const totalRows = await db
    .select({ total: sql<number>`count(*)`.as('total') })
    .from(weddingIncidents)
    .where(eq(weddingIncidents.weddingId, weddingId));
  const open  = openRows[0]?.open  ?? 0;
  const total = totalRows[0]?.total ?? 0;
  return { open: Number(open), total: Number(total) };
}
