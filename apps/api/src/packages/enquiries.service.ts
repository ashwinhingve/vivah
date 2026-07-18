/**
 * Smart Shaadi — Premium package enquiries (Phase 8, Unit 8.1)
 * apps/api/src/packages/enquiries.service.ts
 *
 * A package enquiry IS a vendor inquiry with `package_id` set. This file
 * deliberately writes to `vendor_inquiries` rather than introducing a second
 * enquiry table, so package leads inherit the workflow that already exists
 * there: vendor reply, NEW/REPLIED/CONVERTED/CLOSED status, the vendor's
 * "inquiries" inbox, and the notification queue.
 *
 * Enquiries are the ONLY commercial action open on placeholder inventory. There
 * is intentionally no placeholder check in this file — see
 * `assertBookable()` in ./service.ts, which is where the flag does gate money.
 * Capturing a lead against a preview listing is the entire point of seeding it.
 */

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { premiumPackages, vendorInquiries, vendors, user } from '@smartshaadi/db';
import { notificationsQueue } from '../infrastructure/redis/queues.js';
import type { VendorInquiry } from '@smartshaadi/types';
import type { CreatePackageEnquiryInput } from '@smartshaadi/schemas';
import { PackageError } from './service.js';

type InquiryRow = typeof vendorInquiries.$inferSelect;

function toJSON(
  row: InquiryRow,
  extra: { packageTitle?: string | null; vendorName?: string | null; customerName?: string | null } = {},
): VendorInquiry & { packageId: string | null; packageTitle?: string } {
  const base = {
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
    packageId:    row.packageId,
  } as VendorInquiry & { packageId: string | null; packageTitle?: string };

  if (extra.vendorName)   base.vendorName   = extra.vendorName;
  if (extra.customerName) base.customerName = extra.customerName;
  if (extra.packageTitle) base.packageTitle = extra.packageTitle;
  return base;
}

/**
 * Raise an enquiry against a package.
 *
 * The vendor is resolved FROM the package rather than taken from the caller, so
 * a client cannot attribute a lead to a vendor that does not own the package.
 */
export async function createPackageEnquiry(
  customerId: string,
  packageId:  string,
  input:      CreatePackageEnquiryInput,
): Promise<VendorInquiry & { packageId: string | null }> {
  const [row] = await db
    .select({
      packageId:    premiumPackages.id,
      packageTitle: premiumPackages.title,
      isActive:     premiumPackages.isActive,
      vendorId:     vendors.id,
      vendorUserId: vendors.userId,
      vendorName:   vendors.businessName,
    })
    .from(premiumPackages)
    .innerJoin(vendors, eq(premiumPackages.vendorId, vendors.id))
    .where(eq(premiumPackages.id, packageId))
    .limit(1);

  if (!row) throw new PackageError('NOT_FOUND', 'Package not found');
  // Retired listings stop taking leads. Placeholder ones do NOT — that is the
  // distinction this feature turns on.
  if (!row.isActive) {
    throw new PackageError('INVALID_STATE', 'This package is no longer accepting enquiries');
  }

  const [inserted] = await db
    .insert(vendorInquiries)
    .values({
      vendorId:   row.vendorId,
      customerId,
      packageId:  row.packageId,
      // A package already states its own ceremony scope, so the enquiry does not
      // force the customer to restate it as a vendor brief would.
      eventDate:  input.eventDate ?? null,
      guestCount: input.guestCount ?? null,
      budgetMin:  input.budgetMin ?? null,
      budgetMax:  input.budgetMax ?? null,
      message:    input.message,
    })
    .returning();

  if (!inserted) throw new PackageError('INSERT_FAILED', 'Failed to create enquiry');

  // Best-effort, and never inside the request's critical path — matches the
  // existing vendor inquiry flow and CLAUDE.md rule 8 (no sync notifications).
  try {
    await notificationsQueue.add('NEW_BOOKING_REQUEST', {
      userId:  row.vendorUserId,
      type:    'NEW_BOOKING_REQUEST',
      payload: {
        kind:      'package_enquiry',
        inquiryId: inserted.id,
        packageId: row.packageId,
        vendorId:  row.vendorId,
        customerId,
      },
    });
  } catch (e) {
    console.error('[packages/enquiry] notify failed:', e);
  }

  return toJSON(inserted, { vendorName: row.vendorName, packageTitle: row.packageTitle });
}

/**
 * The signed-in customer's package enquiries, newest first.
 *
 * Filtered by `customerId` (CLAUDE.md rule 2) AND by `package_id IS NOT NULL`,
 * so this endpoint returns only package leads — plain vendor inquiries stay in
 * the existing /vendors/inquiries/mine view rather than appearing twice.
 */
export async function listMyPackageEnquiries(
  customerId: string,
  page = 1,
  limit = 20,
): Promise<{ enquiries: Array<VendorInquiry & { packageId: string | null }>; total: number; page: number; limit: number }> {
  const where = and(
    eq(vendorInquiries.customerId, customerId),
    isNotNull(vendorInquiries.packageId),
  );

  const offset = (page - 1) * limit;

  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(vendorInquiries)
    .where(where);

  const rows = await db
    .select({
      inq:          vendorInquiries,
      packageTitle: premiumPackages.title,
      vendorName:   vendors.businessName,
    })
    .from(vendorInquiries)
    .leftJoin(premiumPackages, eq(vendorInquiries.packageId, premiumPackages.id))
    .leftJoin(vendors, eq(vendorInquiries.vendorId, vendors.id))
    .where(where)
    .orderBy(desc(vendorInquiries.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    enquiries: rows.map((r) =>
      toJSON(r.inq, { packageTitle: r.packageTitle, vendorName: r.vendorName })),
    total: countRow?.count ?? 0,
    page,
    limit,
  };
}

/**
 * Admin triage across every package enquiry.
 *
 * Placeholder inventory has no real vendor to answer its leads, so without this
 * view those enquiries would land in an inbox nobody reads. Joining the customer
 * name here is safe: this is an ADMIN-only route. Contact details are NOT
 * selected (CLAUDE.md rule 5) — the admin opens the user record for those.
 */
export async function listAllPackageEnquiriesForAdmin(
  page = 1,
  limit = 50,
): Promise<{ enquiries: Array<VendorInquiry & { packageId: string | null }>; total: number; page: number; limit: number }> {
  const where = isNotNull(vendorInquiries.packageId);
  const offset = (page - 1) * limit;

  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(vendorInquiries)
    .where(where);

  const rows = await db
    .select({
      inq:          vendorInquiries,
      packageTitle: premiumPackages.title,
      vendorName:   vendors.businessName,
      customerName: user.name,
    })
    .from(vendorInquiries)
    .leftJoin(premiumPackages, eq(vendorInquiries.packageId, premiumPackages.id))
    .leftJoin(vendors, eq(vendorInquiries.vendorId, vendors.id))
    .leftJoin(user, eq(user.id, vendorInquiries.customerId))
    .where(where)
    .orderBy(desc(vendorInquiries.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    enquiries: rows.map((r) => toJSON(r.inq, {
      packageTitle: r.packageTitle,
      vendorName:   r.vendorName,
      customerName: r.customerName,
    })),
    total: countRow?.count ?? 0,
    page,
    limit,
  };
}
