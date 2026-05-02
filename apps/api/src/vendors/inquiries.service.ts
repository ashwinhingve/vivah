/**
 * Vendor inquiries — pre-booking quote requests with vendor reply workflow.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { vendorInquiries, vendors, user } from '@smartshaadi/db';
import { notificationsQueue } from '../infrastructure/redis/queues.js';
import type { VendorInquiry } from '@smartshaadi/types';
import type { CreateInquiryInput, InquiryReplyInput } from '@smartshaadi/schemas';

export class InquiryError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'InquiryError';
  }
}

type Row = typeof vendorInquiries.$inferSelect;

function toJSON(row: Row, vendorName?: string | null, customerName?: string | null): VendorInquiry {
  const base: VendorInquiry = {
    id:           row.id,
    vendorId:     row.vendorId,
    customerId:   row.customerId,
    ceremonyType: row.ceremonyType ?? null,
    eventDate:    row.eventDate ?? null,
    guestCount:   row.guestCount ?? null,
    budgetMin:    row.budgetMin != null ? parseFloat(row.budgetMin) : null,
    budgetMax:    row.budgetMax != null ? parseFloat(row.budgetMax) : null,
    message:      row.message,
    vendorReply:  row.vendorReply,
    repliedAt:    row.repliedAt?.toISOString() ?? null,
    status:       row.status,
    createdAt:    row.createdAt.toISOString(),
  };
  if (vendorName)   base.vendorName   = vendorName;
  if (customerName) base.customerName = customerName;
  return base;
}

export async function createInquiry(
  customerId: string,
  vendorId:   string,
  input:      CreateInquiryInput,
): Promise<VendorInquiry> {
  const [vendor] = await db
    .select({ id: vendors.id, userId: vendors.userId, businessName: vendors.businessName })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) throw new InquiryError('NOT_FOUND', 'Vendor not found');

  const [inserted] = await db
    .insert(vendorInquiries)
    .values({
      vendorId,
      customerId,
      ceremonyType: input.ceremonyType as Row['ceremonyType'] ?? null,
      eventDate:    input.eventDate ?? null,
      guestCount:   input.guestCount ?? null,
      budgetMin:    input.budgetMin != null ? String(input.budgetMin) : null,
      budgetMax:    input.budgetMax != null ? String(input.budgetMax) : null,
      message:      input.message,
    })
    .returning();

  if (!inserted) throw new InquiryError('INSERT_FAILED', 'Failed to create inquiry');

  // Notify vendor
  try {
    await notificationsQueue.add('NEW_BOOKING_REQUEST', {
      userId:  vendor.userId,
      type:    'NEW_BOOKING_REQUEST',
      payload: { kind: 'inquiry', inquiryId: inserted.id, vendorId, customerId },
    });
  } catch (e) {
    console.error('[inquiries/create] notify failed:', e);
  }

  return toJSON(inserted, vendor.businessName);
}

export async function listVendorInquiries(
  vendorUserId: string,
  status?:      'NEW' | 'REPLIED' | 'CONVERTED' | 'CLOSED',
  page = 1,
  limit = 20,
): Promise<{ inquiries: VendorInquiry[]; total: number; page: number; limit: number }> {
  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, vendorUserId))
    .limit(1);

  if (!vendor) {
    return { inquiries: [], total: 0, page, limit };
  }

  const conds = [eq(vendorInquiries.vendorId, vendor.id)];
  if (status) conds.push(eq(vendorInquiries.status, status));
  const where = conds.length > 1 ? and(...conds)! : conds[0]!;

  const offset = (page - 1) * limit;
  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(vendorInquiries)
    .where(where);
  const total = countRow?.count ?? 0;

  const rows = await db
    .select({ inq: vendorInquiries, name: user.name })
    .from(vendorInquiries)
    .leftJoin(user, eq(user.id, vendorInquiries.customerId))
    .where(where)
    .orderBy(desc(vendorInquiries.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    inquiries: rows.map((r) => toJSON(r.inq, undefined, r.name)),
    total,
    page,
    limit,
  };
}

export async function listMyInquiries(
  customerId: string,
): Promise<VendorInquiry[]> {
  const rows = await db
    .select({ inq: vendorInquiries, vendorName: vendors.businessName })
    .from(vendorInquiries)
    .innerJoin(vendors, eq(vendors.id, vendorInquiries.vendorId))
    .where(eq(vendorInquiries.customerId, customerId))
    .orderBy(desc(vendorInquiries.createdAt));

  return rows.map((r) => toJSON(r.inq, r.vendorName));
}

export async function replyToInquiry(
  vendorUserId: string,
  inquiryId:    string,
  input:        InquiryReplyInput,
): Promise<VendorInquiry> {
  const [inquiry] = await db
    .select()
    .from(vendorInquiries)
    .where(eq(vendorInquiries.id, inquiryId))
    .limit(1);

  if (!inquiry) throw new InquiryError('NOT_FOUND', 'Inquiry not found');

  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, inquiry.vendorId))
    .limit(1);

  if (!vendor || vendor.userId !== vendorUserId) {
    throw new InquiryError('FORBIDDEN', 'Only the vendor can reply to this inquiry.');
  }

  const [updated] = await db
    .update(vendorInquiries)
    .set({
      vendorReply: input.reply,
      repliedAt:   new Date(),
      status:      input.status,
      updatedAt:   new Date(),
    })
    .where(eq(vendorInquiries.id, inquiryId))
    .returning();

  if (!updated) throw new InquiryError('UPDATE_FAILED', 'Failed to update inquiry');

  // Notify customer
  try {
    await notificationsQueue.add('NEW_MESSAGE', {
      userId:  inquiry.customerId,
      type:    'NEW_MESSAGE',
      payload: { kind: 'inquiry-reply', inquiryId },
    });
  } catch (e) {
    console.error('[inquiries/reply] notify failed:', e);
  }

  return toJSON(updated);
}
