/**
 * Smart Shaadi — Vendor Approval Service (P1-8, docs/PHASE-1-4-AUDIT.md).
 *
 * State machine:
 *   DRAFT → PENDING        (vendor self-submits)
 *   PENDING → UNDER_REVIEW (admin claims for review)
 *   UNDER_REVIEW → APPROVED   (admin approves)
 *   UNDER_REVIEW → REJECTED   (admin rejects with reason + category)
 *   APPROVED → SUSPENDED      (admin suspends with reason)
 *   SUSPENDED → APPROVED      (admin reinstates)
 *
 * Every transition uses an atomic conditional UPDATE
 *   (WHERE id = ? AND status = expected RETURNING)
 * with a zero-row guard, so two admins claiming the same vendor cannot both
 * succeed. Mirrors the pattern in matchmaking/requests/service.ts acceptRequest
 * (P1-3) and payments/service.ts handlePaymentSuccess (P1-2).
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import { appendAuditLog } from '../payments/service.js';
import { notificationsQueue } from '../infrastructure/redis/queues.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VendorStatus = typeof schema.vendorStatusEnum.enumValues[number];
export type RejectionCategory = typeof schema.rejectionCategoryEnum.enumValues[number];

export class VendorApprovalError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'VendorApprovalError';
  }
}

/** Required-field check for DRAFT → PENDING submission. */
function assertSubmittable(vendor: typeof schema.vendors.$inferSelect): void {
  const missing: string[] = [];
  if (!vendor.businessName?.trim()) missing.push('businessName');
  if (!vendor.category) missing.push('category');
  if (!vendor.city?.trim()) missing.push('city');
  if (!vendor.phone?.trim()) missing.push('phone');
  if (missing.length) {
    throw new VendorApprovalError(
      'INCOMPLETE_PROFILE',
      `Profile is missing required fields: ${missing.join(', ')}`,
    );
  }
}

/**
 * Atomic CAS transition. Returns the updated row or throws
 * STATUS_CHANGED_CONCURRENTLY if the row's current status no longer matches
 * the expected one (someone else won the race).
 */
async function casTransition(
  vendorId: string,
  expected: VendorStatus,
  set: Partial<typeof schema.vendors.$inferInsert>,
): Promise<typeof schema.vendors.$inferSelect> {
  const [updated] = await db
    .update(schema.vendors)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(schema.vendors.id, vendorId), eq(schema.vendors.status, expected)))
    .returning();
  if (!updated) {
    throw new VendorApprovalError(
      'STATUS_CHANGED_CONCURRENTLY',
      `Vendor ${vendorId} is no longer in '${expected}' status — another admin may have acted first`,
    );
  }
  return updated;
}

async function fetchVendorOrFail(vendorId: string): Promise<typeof schema.vendors.$inferSelect> {
  const [row] = await db.select().from(schema.vendors).where(eq(schema.vendors.id, vendorId)).limit(1);
  if (!row) throw new VendorApprovalError('VENDOR_NOT_FOUND', `Vendor ${vendorId} not found`);
  return row;
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export async function submitForReview(vendorId: string): Promise<typeof schema.vendors.$inferSelect> {
  const vendor = await fetchVendorOrFail(vendorId);
  assertSubmittable(vendor);
  const updated = await casTransition(vendorId, 'DRAFT', {
    status:      'PENDING',
    submittedAt: new Date(),
  });
  await appendAuditLog({
    eventType:  'VENDOR_SUBMITTED',
    entityType: 'vendor',
    entityId:   vendorId,
    actorId:    vendor.userId,
    payload:    { businessName: vendor.businessName },
  });
  await notificationsQueue.add('VENDOR_SUBMITTED', {
    userId:  vendor.userId,
    type:    'VENDOR_SUBMITTED',
    payload: { vendorId, businessName: vendor.businessName },
  });
  return updated;
}

export async function startReview(
  adminUserId: string,
  vendorId: string,
): Promise<typeof schema.vendors.$inferSelect> {
  const updated = await casTransition(vendorId, 'PENDING', {
    status:           'UNDER_REVIEW',
    reviewedByUserId: adminUserId,
  });
  await appendAuditLog({
    eventType:  'VENDOR_UNDER_REVIEW',
    entityType: 'vendor',
    entityId:   vendorId,
    actorId:    adminUserId,
    payload:    { claimedAt: new Date().toISOString() },
  });
  return updated;
}

export async function approve(
  adminUserId: string,
  vendorId: string,
): Promise<typeof schema.vendors.$inferSelect> {
  const updated = await casTransition(vendorId, 'UNDER_REVIEW', {
    status:           'APPROVED',
    reviewedByUserId: adminUserId,
    reviewedAt:       new Date(),
    rejectionReason:  null,
    rejectionCategory: null,
  });
  await appendAuditLog({
    eventType:  'VENDOR_APPROVED',
    entityType: 'vendor',
    entityId:   vendorId,
    actorId:    adminUserId,
    payload:    { businessName: updated.businessName },
  });
  await notificationsQueue.add('VENDOR_APPROVED', {
    userId:  updated.userId,
    type:    'VENDOR_APPROVED',
    payload: { vendorId, businessName: updated.businessName },
  });
  return updated;
}

export async function reject(
  adminUserId: string,
  vendorId: string,
  reason: string,
  category: RejectionCategory,
): Promise<typeof schema.vendors.$inferSelect> {
  if (!reason || reason.trim().length < 10) {
    throw new VendorApprovalError(
      'REASON_TOO_SHORT',
      'Rejection reason must be at least 10 characters',
    );
  }
  const updated = await casTransition(vendorId, 'UNDER_REVIEW', {
    status:            'REJECTED',
    reviewedByUserId:  adminUserId,
    reviewedAt:        new Date(),
    rejectionReason:   reason.trim(),
    rejectionCategory: category,
  });
  await appendAuditLog({
    eventType:  'VENDOR_REJECTED',
    entityType: 'vendor',
    entityId:   vendorId,
    actorId:    adminUserId,
    payload:    { reason: reason.trim(), category },
  });
  await notificationsQueue.add('VENDOR_REJECTED', {
    userId:  updated.userId,
    type:    'VENDOR_REJECTED',
    payload: { vendorId, reason: reason.trim(), category },
  });
  return updated;
}

export async function suspend(
  adminUserId: string,
  vendorId: string,
  reason: string,
): Promise<typeof schema.vendors.$inferSelect> {
  if (!reason || reason.trim().length < 10) {
    throw new VendorApprovalError(
      'REASON_TOO_SHORT',
      'Suspension reason must be at least 10 characters',
    );
  }
  const updated = await casTransition(vendorId, 'APPROVED', {
    status:           'SUSPENDED',
    reviewedByUserId: adminUserId,
    reviewedAt:       new Date(),
    rejectionReason:  reason.trim(),
  });
  await appendAuditLog({
    eventType:  'VENDOR_SUSPENDED',
    entityType: 'vendor',
    entityId:   vendorId,
    actorId:    adminUserId,
    payload:    { reason: reason.trim() },
  });
  await notificationsQueue.add('VENDOR_SUSPENDED', {
    userId:  updated.userId,
    type:    'VENDOR_SUSPENDED',
    payload: { vendorId, reason: reason.trim() },
  });
  return updated;
}

export async function reinstate(
  adminUserId: string,
  vendorId: string,
): Promise<typeof schema.vendors.$inferSelect> {
  const updated = await casTransition(vendorId, 'SUSPENDED', {
    status:            'APPROVED',
    reviewedByUserId:  adminUserId,
    reviewedAt:        new Date(),
    rejectionReason:   null,
    rejectionCategory: null,
  });
  await appendAuditLog({
    eventType:  'VENDOR_REINSTATED',
    entityType: 'vendor',
    entityId:   vendorId,
    actorId:    adminUserId,
    payload:    { reinstatedAt: new Date().toISOString() },
  });
  await notificationsQueue.add('VENDOR_REINSTATED', {
    userId:  updated.userId,
    type:    'VENDOR_REINSTATED',
    payload: { vendorId },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Self-service read helpers (vendor side)
// ---------------------------------------------------------------------------

export interface VendorStatusView {
  status:             VendorStatus;
  submittedAt:        string | null;
  reviewedAt:         string | null;
  rejectionReason:    string | null;
  rejectionCategory:  RejectionCategory | null;
}

export async function getStatusForUser(userId: string): Promise<VendorStatusView | null> {
  const [row] = await db
    .select({
      status:            schema.vendors.status,
      submittedAt:       schema.vendors.submittedAt,
      reviewedAt:        schema.vendors.reviewedAt,
      rejectionReason:   schema.vendors.rejectionReason,
      rejectionCategory: schema.vendors.rejectionCategory,
    })
    .from(schema.vendors)
    .where(eq(schema.vendors.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    status:            row.status,
    submittedAt:       row.submittedAt?.toISOString() ?? null,
    reviewedAt:        row.reviewedAt?.toISOString() ?? null,
    rejectionReason:   row.rejectionReason ?? null,
    rejectionCategory: row.rejectionCategory ?? null,
  };
}

export async function submitForReviewByUserId(userId: string): Promise<typeof schema.vendors.$inferSelect> {
  const [row] = await db
    .select({ id: schema.vendors.id })
    .from(schema.vendors)
    .where(eq(schema.vendors.userId, userId))
    .limit(1);
  if (!row) throw new VendorApprovalError('VENDOR_NOT_FOUND', 'No vendor profile found for this user');
  return submitForReview(row.id);
}
