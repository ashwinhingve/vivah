/**
 * Vendor Lead service — Tier 3 Track 2 (pay-per-qualified-lead).
 *
 * Flow:
 *   createLead          — any authenticated customer submits an inquiry to a
 *                         vendor. Row lands as PENDING. Wallet untouched.
 *   markLeadQualified   — admin reviews and tags quality. HIGH/MEDIUM →
 *                         debit vendor wallet → CHARGED. LOW/SPAM → CANCELLED.
 *   refundLead          — admin reverses a CHARGED lead (credit wallet back) →
 *                         REFUNDED.
 *   getVendorLeads      — paginated inbox for the vendor dashboard.
 *   getVendorLeadStats  — aggregate counters for the vendor stats card.
 *
 * Wallet wired through apps/api/src/payments/wallet.ts using
 * reason='ADJUSTMENT' (no LEAD_FEE enum value yet) + referenceType='vendor_lead'
 * + referenceId=leadId so transactions remain traceable.
 */
import { and, eq, desc, sql, type SQL } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { vendors, vendorLeads, user } from '@smartshaadi/db';
import { creditWallet, debitWallet, WalletError } from '../payments/wallet.js';

export type LeadFeeStatus =
  | 'PENDING' | 'QUALIFIED' | 'CHARGED' | 'REFUNDED' | 'CANCELLED' | 'PENDING_PAYMENT';
export type LeadQuality = 'HIGH' | 'MEDIUM' | 'LOW' | 'SPAM';

export interface CreateLeadInput {
  vendorId:       string;
  inquirerUserId: string;
  eventType:      'WEDDING' | 'HALDI' | 'MEHNDI' | 'SANGEET' | 'ENGAGEMENT'
                | 'RECEPTION' | 'CORPORATE' | 'FESTIVAL' | 'COMMUNITY'
                | 'COMMUNITY_EVENT' | 'GOVERNMENT' | 'SCHOOL' | 'OTHER';
  eventDate?:     Date | null;
  eventLocation?: string | null;
  message?:       string | null;
}

export class VendorLeadError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'VendorLeadError';
  }
}

/** Create a vendor lead. Snapshots the vendor's current per-inquiry fee. */
export async function createLead(input: CreateLeadInput) {
  const [vendor] = await db
    .select({
      id:               vendors.id,
      userId:           vendors.userId,
      isActive:         vendors.isActive,
      leadFeeEnabled:   vendors.leadFeeEnabled,
      leadFeePerInquiryInr: vendors.leadFeePerInquiryInr,
    })
    .from(vendors)
    .where(eq(vendors.id, input.vendorId))
    .limit(1);

  if (!vendor) throw new VendorLeadError('NOT_FOUND', 'Vendor not found');
  if (!vendor.isActive) throw new VendorLeadError('INACTIVE', 'Vendor is not accepting leads');
  if (vendor.userId === input.inquirerUserId) {
    throw new VendorLeadError('SELF_LEAD', 'Cannot submit a lead to your own vendor profile');
  }

  const feeAmount = vendor.leadFeeEnabled ? vendor.leadFeePerInquiryInr : 0;

  const [row] = await db
    .insert(vendorLeads)
    .values({
      vendorId:        vendor.id,
      inquirerUserId:  input.inquirerUserId,
      eventType:       input.eventType,
      eventDate:       input.eventDate ?? null,
      eventLocation:   input.eventLocation ?? null,
      message:         input.message ?? null,
      feeChargedInr:   feeAmount,
      feeStatus:       'PENDING',
    })
    .returning();

  return row!;
}

/**
 * Admin marks a lead's quality. HIGH/MEDIUM triggers wallet debit.
 * If wallet has insufficient balance, status flips to PENDING_PAYMENT so the
 * lead row stays auditable and the vendor can top-up later.
 */
export async function markLeadQualified(leadId: string, quality: LeadQuality) {
  const [lead] = await db
    .select()
    .from(vendorLeads)
    .where(eq(vendorLeads.id, leadId))
    .limit(1);

  if (!lead) throw new VendorLeadError('NOT_FOUND', 'Lead not found');
  if (lead.feeStatus !== 'PENDING' && lead.feeStatus !== 'PENDING_PAYMENT') {
    throw new VendorLeadError('INVALID_STATE', `Lead is already ${lead.feeStatus}`);
  }

  if (quality === 'LOW' || quality === 'SPAM') {
    const [updated] = await db
      .update(vendorLeads)
      .set({ leadQuality: quality, feeStatus: 'CANCELLED', updatedAt: new Date() })
      .where(eq(vendorLeads.id, leadId))
      .returning();
    return updated!;
  }

  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, lead.vendorId))
    .limit(1);
  if (!vendor) throw new VendorLeadError('VENDOR_GONE', 'Vendor record vanished');

  if (lead.feeChargedInr <= 0) {
    const [updated] = await db
      .update(vendorLeads)
      .set({
        leadQuality: quality,
        feeStatus: 'CHARGED',
        chargedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(vendorLeads.id, leadId))
      .returning();
    return updated!;
  }

  try {
    await debitWallet({
      userId:        vendor.userId,
      amount:        lead.feeChargedInr,
      reason:        'ADJUSTMENT',
      description:   `Lead generation fee: ${lead.id}`,
      referenceType: 'vendor_lead',
      referenceId:   lead.id,
      metadata:      { eventType: lead.eventType, quality },
    });
  } catch (e) {
    if (e instanceof WalletError && e.code === 'INSUFFICIENT_BALANCE') {
      const [updated] = await db
        .update(vendorLeads)
        .set({
          leadQuality: quality,
          feeStatus: 'PENDING_PAYMENT',
          updatedAt: new Date(),
        })
        .where(eq(vendorLeads.id, leadId))
        .returning();
      return updated!;
    }
    throw e;
  }

  const [updated] = await db
    .update(vendorLeads)
    .set({
      leadQuality: quality,
      feeStatus: 'CHARGED',
      chargedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vendorLeads.id, leadId))
    .returning();
  return updated!;
}

/** Reverses a CHARGED lead — credits the vendor wallet back. */
export async function refundLead(leadId: string, reason: string) {
  const [lead] = await db
    .select()
    .from(vendorLeads)
    .where(eq(vendorLeads.id, leadId))
    .limit(1);

  if (!lead) throw new VendorLeadError('NOT_FOUND', 'Lead not found');
  if (lead.feeStatus !== 'CHARGED') {
    throw new VendorLeadError('INVALID_STATE', `Cannot refund lead in state ${lead.feeStatus}`);
  }

  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, lead.vendorId))
    .limit(1);
  if (!vendor) throw new VendorLeadError('VENDOR_GONE', 'Vendor record vanished');

  if (lead.feeChargedInr > 0) {
    await creditWallet({
      userId:        vendor.userId,
      amount:        lead.feeChargedInr,
      reason:        'REFUND',
      description:   `Lead fee refund: ${lead.id}`,
      referenceType: 'vendor_lead',
      referenceId:   lead.id,
      metadata:      { refundReason: reason },
    });
  }

  const [updated] = await db
    .update(vendorLeads)
    .set({
      feeStatus: 'REFUNDED',
      refundReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(vendorLeads.id, leadId))
    .returning();
  return updated!;
}

export interface ListLeadsFilters {
  status?: LeadFeeStatus;
  limit?:  number;
  offset?: number;
}

/** Paginated inbox for the vendor dashboard. Joins inquirer name for display. */
export async function getVendorLeads(vendorId: string, filters: ListLeadsFilters = {}) {
  const limit  = Math.min(Math.max(filters.limit  ?? 20, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);

  const whereClauses: SQL[] = [eq(vendorLeads.vendorId, vendorId)];
  if (filters.status) whereClauses.push(eq(vendorLeads.feeStatus, filters.status));

  const rows = await db
    .select({
      id:            vendorLeads.id,
      vendorId:      vendorLeads.vendorId,
      inquirerUserId: vendorLeads.inquirerUserId,
      inquirerName:  user.name,
      eventType:     vendorLeads.eventType,
      eventDate:     vendorLeads.eventDate,
      eventLocation: vendorLeads.eventLocation,
      message:       vendorLeads.message,
      feeChargedInr: vendorLeads.feeChargedInr,
      feeStatus:     vendorLeads.feeStatus,
      leadQuality:   vendorLeads.leadQuality,
      chargedAt:     vendorLeads.chargedAt,
      refundReason:  vendorLeads.refundReason,
      createdAt:     vendorLeads.createdAt,
    })
    .from(vendorLeads)
    .leftJoin(user, eq(user.id, vendorLeads.inquirerUserId))
    .where(and(...whereClauses))
    .orderBy(desc(vendorLeads.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

/** Aggregate stats card data: lifetime counts + current-month charges. */
export async function getVendorLeadStats(vendorId: string) {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [agg] = await db
    .select({
      totalLeads:      sql<number>`count(*)::int`,
      qualifiedLeads:  sql<number>`count(*) filter (where ${vendorLeads.feeStatus} in ('CHARGED','REFUNDED','PENDING_PAYMENT'))::int`,
      chargedLeads:    sql<number>`count(*) filter (where ${vendorLeads.feeStatus} = 'CHARGED')::int`,
      cancelledLeads:  sql<number>`count(*) filter (where ${vendorLeads.feeStatus} = 'CANCELLED')::int`,
      pendingLeads:    sql<number>`count(*) filter (where ${vendorLeads.feeStatus} = 'PENDING')::int`,
      lifetimeCharged: sql<number>`coalesce(sum(${vendorLeads.feeChargedInr}) filter (where ${vendorLeads.feeStatus} = 'CHARGED'), 0)::int`,
      monthCharged:    sql<number>`coalesce(sum(${vendorLeads.feeChargedInr}) filter (where ${vendorLeads.feeStatus} = 'CHARGED' and ${vendorLeads.chargedAt} >= ${startOfMonth}), 0)::int`,
    })
    .from(vendorLeads)
    .where(eq(vendorLeads.vendorId, vendorId));

  const stats = agg ?? {
    totalLeads: 0, qualifiedLeads: 0, chargedLeads: 0,
    cancelledLeads: 0, pendingLeads: 0, lifetimeCharged: 0, monthCharged: 0,
  };

  const qualifiedRate = stats.totalLeads > 0
    ? stats.qualifiedLeads / stats.totalLeads
    : 0;
  const avgFee = stats.chargedLeads > 0
    ? stats.lifetimeCharged / stats.chargedLeads
    : 0;

  return {
    totalLeads:      stats.totalLeads,
    qualifiedLeads:  stats.qualifiedLeads,
    chargedLeads:    stats.chargedLeads,
    cancelledLeads:  stats.cancelledLeads,
    pendingLeads:    stats.pendingLeads,
    lifetimeChargedInr: stats.lifetimeCharged,
    monthChargedInr:    stats.monthCharged,
    qualifiedRate,
    avgFeeInr: Math.round(avgFee),
  };
}
