/**
 * Smart Shaadi — Post-marriage service enquiries (Phase 8, Unit 8.2)
 * apps/api/src/post-marriage/enquiries.service.ts
 *
 * Unit 8.1 reuses `vendor_inquiries` because a package belongs to a real vendor
 * with a user account who can reply. A service partner has NO user account while
 * it is placeholder inventory, so its enquiries live in their own table and are
 * answered by an admin from the triage queue. Overloading `vendor_inquiries`
 * would have meant inventing a fake vendor row per partner just to satisfy a
 * NOT NULL FK.
 *
 * Every service converts through an enquiry — there is no booking or payment
 * path in 8.2 — so `is_placeholder` gates nothing here.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  serviceEnquiries,
  postMarriageServices,
  servicePartners,
  user,
} from '@smartshaadi/db';
import { notificationsQueue } from '../infrastructure/redis/queues.js';
import type { ServiceEnquiry, ServiceEnquiryStatus } from '@smartshaadi/types';
import type { CreateServiceEnquiryInput, ReplyServiceEnquiryInput } from '@smartshaadi/schemas';
import { PostMarriageError } from './service.js';

type EnquiryRow = typeof serviceEnquiries.$inferSelect;

function toJSON(
  row: EnquiryRow,
  extra: { serviceTitle?: string | null; partnerName?: string | null; customerName?: string | null } = {},
): ServiceEnquiry {
  const base: ServiceEnquiry = {
    id:         row.id,
    serviceId:  row.serviceId,
    partnerId:  row.partnerId,
    customerId: row.customerId,
    message:          row.message,
    preferredContact: row.preferredContact,
    city:             row.city,
    status:       row.status,
    partnerReply: row.partnerReply,
    repliedAt:    row.repliedAt?.toISOString() ?? null,
    createdAt:    row.createdAt.toISOString(),
    updatedAt:    row.updatedAt.toISOString(),
  };
  if (extra.serviceTitle) base.serviceTitle = extra.serviceTitle;
  if (extra.partnerName)  base.partnerName  = extra.partnerName;
  if (extra.customerName) base.customerName = extra.customerName;
  return base;
}

/**
 * Raise an enquiry against a service.
 *
 * `partnerId` is resolved FROM the service rather than accepted from the client,
 * so a caller cannot attribute a lead to a partner that does not own it.
 */
export async function createServiceEnquiry(
  customerId: string,
  serviceId:  string,
  input:      CreateServiceEnquiryInput,
): Promise<ServiceEnquiry> {
  const [row] = await db
    .select({
      serviceId:    postMarriageServices.id,
      serviceTitle: postMarriageServices.title,
      serviceActive: postMarriageServices.isActive,
      partnerId:    servicePartners.id,
      partnerName:  servicePartners.name,
      partnerActive: servicePartners.isActive,
    })
    .from(postMarriageServices)
    .innerJoin(servicePartners, eq(postMarriageServices.partnerId, servicePartners.id))
    .where(eq(postMarriageServices.id, serviceId))
    .limit(1);

  if (!row) throw new PostMarriageError('NOT_FOUND', 'Service not found');
  if (!row.serviceActive || !row.partnerActive) {
    throw new PostMarriageError('INVALID_STATE', 'This service is no longer accepting enquiries');
  }

  const [inserted] = await db
    .insert(serviceEnquiries)
    .values({
      serviceId: row.serviceId,
      partnerId: row.partnerId,
      customerId,
      message:          input.message,
      preferredContact: input.preferredContact ?? null,
      city:             input.city ?? null,
    })
    .returning();

  if (!inserted) throw new PostMarriageError('INSERT_FAILED', 'Failed to create enquiry');

  // Best-effort and off the request's critical path (CLAUDE.md rule 8).
  // Addressed to the CUSTOMER — a placeholder partner has no user account to
  // notify, and acknowledging receipt is what the customer actually needs.
  try {
    await notificationsQueue.add('GENERIC', {
      userId:  customerId,
      type:    'GENERIC',
      payload: {
        kind:      'service_enquiry_received',
        enquiryId: inserted.id,
        serviceId: row.serviceId,
        partnerId: row.partnerId,
      },
    });
  } catch (e) {
    console.error('[post-marriage/enquiry] notify failed:', e);
  }

  return toJSON(inserted, { serviceTitle: row.serviceTitle, partnerName: row.partnerName });
}

/** The signed-in customer's enquiries. Filtered by customerId (rule 2). */
export async function listMyServiceEnquiries(
  customerId: string,
  page = 1,
  limit = 20,
): Promise<{ enquiries: ServiceEnquiry[]; total: number; page: number; limit: number }> {
  const where = eq(serviceEnquiries.customerId, customerId);
  const offset = (page - 1) * limit;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(serviceEnquiries)
    .where(where);

  const rows = await db
    .select({
      enq:          serviceEnquiries,
      serviceTitle: postMarriageServices.title,
      partnerName:  servicePartners.name,
    })
    .from(serviceEnquiries)
    .leftJoin(postMarriageServices, eq(serviceEnquiries.serviceId, postMarriageServices.id))
    .leftJoin(servicePartners, eq(serviceEnquiries.partnerId, servicePartners.id))
    .where(where)
    .orderBy(desc(serviceEnquiries.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    enquiries: rows.map((r) =>
      toJSON(r.enq, { serviceTitle: r.serviceTitle, partnerName: r.partnerName })),
    total: countRow?.total ?? 0,
    page,
    limit,
  };
}

/**
 * Admin triage queue. Placeholder partners cannot answer their own leads, so
 * without this view those enquiries would go unread.
 *
 * The customer's NAME is joined but NOT their phone or email (CLAUDE.md rule 5)
 * — the admin opens the user record for contact details, so this list cannot
 * become an unintended contact export.
 */
export async function listAllServiceEnquiriesForAdmin(
  status?: ServiceEnquiryStatus,
  page = 1,
  limit = 50,
): Promise<{ enquiries: ServiceEnquiry[]; total: number; page: number; limit: number }> {
  const where = status ? eq(serviceEnquiries.status, status) : undefined;
  const offset = (page - 1) * limit;

  const countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(serviceEnquiries);
  const [countRow] = where ? await countQuery.where(where) : await countQuery;

  const baseQuery = db
    .select({
      enq:          serviceEnquiries,
      serviceTitle: postMarriageServices.title,
      partnerName:  servicePartners.name,
      customerName: user.name,
    })
    .from(serviceEnquiries)
    .leftJoin(postMarriageServices, eq(serviceEnquiries.serviceId, postMarriageServices.id))
    .leftJoin(servicePartners, eq(serviceEnquiries.partnerId, servicePartners.id))
    .leftJoin(user, eq(user.id, serviceEnquiries.customerId));

  const rows = where
    ? await baseQuery.where(where).orderBy(desc(serviceEnquiries.createdAt)).limit(limit).offset(offset)
    : await baseQuery.orderBy(desc(serviceEnquiries.createdAt)).limit(limit).offset(offset);

  return {
    enquiries: rows.map((r) => toJSON(r.enq, {
      serviceTitle: r.serviceTitle,
      partnerName:  r.partnerName,
      customerName: r.customerName,
    })),
    total: countRow?.total ?? 0,
    page,
    limit,
  };
}

/**
 * Admin replies on the partner's behalf.
 *
 * The status transition is an atomic conditional UPDATE guarded on the current
 * status, not a read-then-write: two admins opening the same enquiry would
 * otherwise both pass a "still OPEN?" check and the second would overwrite the
 * first's reply. The loser here gets CONFLICT instead (DoD item 5, no TOCTOU).
 */
export async function replyToServiceEnquiry(
  enquiryId: string,
  input:     ReplyServiceEnquiryInput,
): Promise<ServiceEnquiry> {
  const [updated] = await db
    .update(serviceEnquiries)
    .set({
      partnerReply: input.partnerReply,
      status:       input.status,
      repliedAt:    new Date(),
      updatedAt:    new Date(),
    })
    .where(and(
      eq(serviceEnquiries.id, enquiryId),
      // Only an unanswered enquiry may be answered.
      eq(serviceEnquiries.status, 'OPEN'),
    ))
    .returning();

  if (!updated) {
    // Distinguish "no such enquiry" from "already answered" so the admin UI can
    // say something true rather than a generic failure.
    const [exists] = await db
      .select({ status: serviceEnquiries.status })
      .from(serviceEnquiries)
      .where(eq(serviceEnquiries.id, enquiryId))
      .limit(1);
    if (!exists) throw new PostMarriageError('NOT_FOUND', 'Enquiry not found');
    throw new PostMarriageError(
      'CONFLICT',
      `This enquiry has already been handled (status: ${exists.status})`,
    );
  }

  // Tell the customer their enquiry was answered.
  try {
    await notificationsQueue.add('GENERIC', {
      userId:  updated.customerId,
      type:    'GENERIC',
      payload: { kind: 'service_enquiry_replied', enquiryId: updated.id },
    });
  } catch (e) {
    console.error('[post-marriage/reply] notify failed:', e);
  }

  return toJSON(updated);
}
