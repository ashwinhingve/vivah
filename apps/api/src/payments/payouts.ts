/**
 * Smart Shaadi — Vendor Payouts Service.
 *
 * One payouts row per vendor settlement. Source can be a booking escrow
 * release, a dispute resolution, or a store-order fulfilment.
 *
 * platformFee + taxWithheld are captured for revenue recognition.
 */
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import * as schema from '@smartshaadi/db';
import { transferToVendor } from '../lib/razorpay.js';
import { appendAuditLog } from './service.js';
import { notificationsQueue } from '../infrastructure/redis/queues.js';
import type { PayoutScheduleInput } from '@smartshaadi/schemas';

export class PayoutError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'PayoutError';
  }
}

const PLATFORM_FEE_PCT = 0.03; // 3% default (override per request via input.platformFee)

export interface SchedulePayoutResult {
  id:          string;
  vendorId:    string;
  netAmount:   string;
  status:      string;
}

export async function schedulePayout(input: PayoutScheduleInput): Promise<SchedulePayoutResult> {
  const [vendor] = await db
    .select({
      id:                     schema.vendors.id,
      commissionPct:          schema.vendors.commissionPct,
      bankVerificationStatus: schema.vendors.bankVerificationStatus,
    })
    .from(schema.vendors)
    .where(eq(schema.vendors.id, input.vendorId))
    .limit(1);
  if (!vendor) throw new PayoutError('NOT_FOUND', 'Vendor not found');
  if (vendor.bankVerificationStatus !== 'VERIFIED') {
    throw new PayoutError('BANK_NOT_VERIFIED', 'Vendor bank account not verified');
  }

  const vendorCommissionPct = vendor.commissionPct ? Number(vendor.commissionPct) / 100 : PLATFORM_FEE_PCT;
  const platformFee = input.platformFee ?? Math.round(input.grossAmount * vendorCommissionPct * 100) / 100;
  const netAmount   = Math.round((input.grossAmount - platformFee - input.taxWithheld) * 100) / 100;
  if (netAmount <= 0) throw new PayoutError('INVALID_AMOUNT', 'Net payout would be ≤ 0');

  const [payout] = await db
    .insert(schema.payouts)
    .values({
      vendorId:     input.vendorId,
      bookingId:    input.bookingId ?? null,
      orderId:      input.orderId ?? null,
      grossAmount:  String(input.grossAmount),
      platformFee:  String(platformFee),
      taxWithheld:  String(input.taxWithheld),
      netAmount:    String(netAmount),
      status:       'SCHEDULED',
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : new Date(),
    })
    .returning();

  await appendAuditLog({
    eventType:  'PAYOUT_INITIATED',
    entityType: 'payout',
    entityId:   payout!.id,
    actorId:    'system',
    payload:    { vendorId: input.vendorId, grossAmount: input.grossAmount, platformFee, netAmount },
  });

  return {
    id:        payout!.id,
    vendorId:  payout!.vendorId,
    netAmount: payout!.netAmount,
    status:    payout!.status,
  };
}

export async function processPayout(payoutId: string) {
  const [payout] = await db
    .update(schema.payouts)
    .set({ status: 'PROCESSING', attempts: sql`${schema.payouts.attempts} + 1` })
    .where(and(eq(schema.payouts.id, payoutId), inArray(schema.payouts.status, ['SCHEDULED', 'FAILED'])))
    .returning();
  if (!payout) throw new PayoutError('INVALID_STATE', 'Payout not in a startable state');

  try {
    const transferRef = await transferToVendor(payout.vendorId, parseFloat(payout.netAmount));
    await db
      .update(schema.payouts)
      .set({
        status:             'COMPLETED',
        razorpayTransferId: transferRef.id,
        processedAt:        new Date(),
      })
      .where(eq(schema.payouts.id, payoutId));

    await appendAuditLog({
      eventType:  'PAYOUT_COMPLETED',
      entityType: 'payout',
      entityId:   payoutId,
      actorId:    'system',
      payload:    { transferRef: transferRef.id, netAmount: payout.netAmount },
    });

    void notificationsQueue
      .add('PAYOUT_INITIATED', {
        type:    'PAYOUT_INITIATED',
        userId:  payout.vendorId,
        payload: { payoutId, netAmount: payout.netAmount },
      })
      .catch(() => undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown failure';
    await db
      .update(schema.payouts)
      .set({ status: 'FAILED', failureReason: msg.slice(0, 1000) })
      .where(eq(schema.payouts.id, payoutId));

    await appendAuditLog({
      eventType:  'PAYOUT_FAILED',
      entityType: 'payout',
      entityId:   payoutId,
      actorId:    'system',
      payload:    { reason: msg },
    });

    void notificationsQueue
      .add('PAYOUT_FAILED', {
        type:    'PAYOUT_FAILED',
        userId:  payout.vendorId,
        payload: { payoutId, reason: msg },
      })
      .catch(() => undefined);
    if (env.NODE_ENV !== 'test') console.error(`[payouts] ${payoutId} failed:`, e);
    throw e;
  }
}

export async function listVendorPayouts(vendorId: string, limit = 50) {
  return db
    .select()
    .from(schema.payouts)
    .where(eq(schema.payouts.vendorId, vendorId))
    .orderBy(desc(schema.payouts.createdAt))
    .limit(limit);
}

export async function adminListAllPayouts(limit = 100, status?: string) {
  return db
    .select()
    .from(schema.payouts)
    .where(status ? eq(schema.payouts.status, status as typeof schema.payoutStatusEnum.enumValues[number]) : undefined)
    .orderBy(desc(schema.payouts.createdAt))
    .limit(limit);
}

export async function adminRetryPayout(adminId: string, payoutId: string) {
  const [admin] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminId))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') throw new PayoutError('FORBIDDEN', 'Admin role required');

  await db
    .update(schema.payouts)
    .set({ status: 'SCHEDULED', failureReason: null })
    .where(and(eq(schema.payouts.id, payoutId), eq(schema.payouts.status, 'FAILED')));
  return processPayout(payoutId);
}

export async function getVendorPayoutSummary(vendorId: string) {
  const [agg] = await db
    .select({
      lifetimePaid:   sql<string>`COALESCE(SUM(CASE WHEN ${schema.payouts.status}='COMPLETED' THEN ${schema.payouts.netAmount} ELSE 0 END), 0)`,
      pendingAmount:  sql<string>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} IN ('SCHEDULED','PROCESSING') THEN ${schema.payouts.netAmount} ELSE 0 END), 0)`,
      failedAmount:   sql<string>`COALESCE(SUM(CASE WHEN ${schema.payouts.status}='FAILED' THEN ${schema.payouts.netAmount} ELSE 0 END), 0)`,
      payoutCount:    sql<string>`COUNT(*)`,
    })
    .from(schema.payouts)
    .where(eq(schema.payouts.vendorId, vendorId));

  return {
    vendorId,
    lifetimePaid:  Number(agg?.lifetimePaid ?? 0),
    pendingAmount: Number(agg?.pendingAmount ?? 0),
    failedAmount:  Number(agg?.failedAmount ?? 0),
    payoutCount:   Number(agg?.payoutCount ?? 0),
  };
}
