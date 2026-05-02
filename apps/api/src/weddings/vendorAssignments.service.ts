/**
 * Smart Shaadi — Wedding vendor assignments
 *
 * Links shortlisted/booked vendors to a wedding (and optionally a specific
 * ceremony). When a booking is created downstream, the assignment is
 * upgraded from SHORTLISTED → BOOKED → CONFIRMED.
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  weddingVendorAssignments,
  vendors,
} from '@smartshaadi/db';
import type { WeddingVendorAssignment } from '@smartshaadi/types';
import type {
  AssignVendorInput,
  UpdateVendorAssignmentInput,
} from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

export async function listAssignments(
  weddingId: string,
  userId: string,
): Promise<WeddingVendorAssignment[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  const rows = await db
    .select({
      a: weddingVendorAssignments,
      vendorName: vendors.businessName,
    })
    .from(weddingVendorAssignments)
    .leftJoin(vendors, eq(vendors.id, weddingVendorAssignments.vendorId))
    .where(eq(weddingVendorAssignments.weddingId, weddingId))
    .orderBy(desc(weddingVendorAssignments.createdAt));

  return rows.map((r): WeddingVendorAssignment => ({
    id:         r.a.id,
    weddingId:  r.a.weddingId,
    ceremonyId: r.a.ceremonyId,
    vendorId:   r.a.vendorId,
    vendorName: r.vendorName ?? null,
    bookingId:  r.a.bookingId,
    role:       r.a.role,
    status:     r.a.status,
    notes:      r.a.notes,
    createdAt:  r.a.createdAt.toISOString(),
  }));
}

export async function assignVendor(
  weddingId: string,
  userId: string,
  input: AssignVendorInput,
): Promise<WeddingVendorAssignment> {
  await requireRole(weddingId, userId, 'EDITOR');

  // Verify vendor exists
  const [v] = await db.select({ id: vendors.id, name: vendors.businessName }).from(vendors)
    .where(eq(vendors.id, input.vendorId)).limit(1);
  if (!v) throw appErr('Vendor not found', 'NOT_FOUND', 404);

  const [row] = await db
    .insert(weddingVendorAssignments)
    .values({
      weddingId,
      ceremonyId: input.ceremonyId ?? null,
      vendorId:   input.vendorId,
      bookingId:  input.bookingId ?? null,
      role:       input.role,
      status:     input.status ?? 'SHORTLISTED',
      notes:      input.notes ?? null,
    })
    .returning();
  if (!row) throw appErr('Assignment failed', 'ASSIGN_FAILED', 500);

  await logActivity(weddingId, userId, 'vendor.assign', 'vendorAssignment', row.id, { vendorId: input.vendorId, role: input.role });

  return {
    id: row.id, weddingId: row.weddingId, ceremonyId: row.ceremonyId,
    vendorId: row.vendorId, vendorName: v.name ?? null, bookingId: row.bookingId,
    role: row.role, status: row.status, notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function updateAssignment(
  weddingId: string,
  userId: string,
  assignmentId: string,
  input: UpdateVendorAssignmentInput,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  const updates: Partial<typeof weddingVendorAssignments.$inferInsert> = { updatedAt: new Date() };
  if (input.ceremonyId !== undefined) updates.ceremonyId = input.ceremonyId ?? null;
  if (input.bookingId  !== undefined) updates.bookingId  = input.bookingId ?? null;
  if (input.role       !== undefined) updates.role       = input.role;
  if (input.status     !== undefined) updates.status     = input.status;
  if (input.notes      !== undefined) updates.notes      = input.notes ?? null;

  const updated = await db
    .update(weddingVendorAssignments)
    .set(updates)
    .where(and(eq(weddingVendorAssignments.id, assignmentId), eq(weddingVendorAssignments.weddingId, weddingId)))
    .returning({ id: weddingVendorAssignments.id });
  if (updated.length === 0) throw appErr('Assignment not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'vendor.assign.update', 'vendorAssignment', assignmentId);
}

export async function removeAssignment(
  weddingId: string,
  userId: string,
  assignmentId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  const deleted = await db.delete(weddingVendorAssignments)
    .where(and(eq(weddingVendorAssignments.id, assignmentId), eq(weddingVendorAssignments.weddingId, weddingId)))
    .returning({ id: weddingVendorAssignments.id });
  if (deleted.length === 0) throw appErr('Assignment not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'vendor.assign.remove', 'vendorAssignment', assignmentId);
}
