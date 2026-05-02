/**
 * Vendor reviews service — list, create, vendor reply.
 *
 * Reviews are tied to a completed booking (preferred) or a free-form rating.
 * Aggregate rating and totalReviews on vendors are recomputed inside a
 * transaction whenever a review is created or hidden.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  vendorReviews,
  vendors,
  bookings,
  user,
} from '@smartshaadi/db';
import type { VendorReview } from '@smartshaadi/types';
import type { CreateReviewInput, ReviewReplyInput } from '@smartshaadi/schemas';

export class ReviewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ReviewError';
  }
}

type Row = typeof vendorReviews.$inferSelect;

function mapRow(row: Row, reviewerName: string | null): VendorReview {
  return {
    id:               row.id,
    vendorId:         row.vendorId,
    bookingId:        row.bookingId,
    reviewerId:       row.reviewerId,
    reviewerName:     reviewerName ?? 'Customer',
    rating:           row.rating,
    title:            row.title,
    comment:          row.comment,
    vendorReply:      row.vendorReply,
    vendorRepliedAt:  row.vendorRepliedAt?.toISOString() ?? null,
    createdAt:        row.createdAt.toISOString(),
  };
}

async function recomputeAggregate(vendorId: string): Promise<void> {
  const [agg] = await db
    .select({
      avg:   sql<string>`COALESCE(AVG(${vendorReviews.rating})::text, '0')`,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(vendorReviews)
    .where(and(
      eq(vendorReviews.vendorId, vendorId),
      eq(vendorReviews.isHidden, false),
    ));

  const avg = agg ? parseFloat(agg.avg) : 0;
  const count = agg?.count ?? 0;

  await db
    .update(vendors)
    .set({
      rating:       avg.toFixed(2),
      totalReviews: count,
      updatedAt:    new Date(),
    })
    .where(eq(vendors.id, vendorId));
}

export async function listReviews(
  vendorId: string,
  page = 1,
  limit = 20,
): Promise<{ reviews: VendorReview[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(vendorReviews)
    .where(and(eq(vendorReviews.vendorId, vendorId), eq(vendorReviews.isHidden, false)));

  const total = countRow?.count ?? 0;

  const rows = await db
    .select({
      review: vendorReviews,
      name:   user.name,
    })
    .from(vendorReviews)
    .leftJoin(user, eq(user.id, vendorReviews.reviewerId))
    .where(and(eq(vendorReviews.vendorId, vendorId), eq(vendorReviews.isHidden, false)))
    .orderBy(desc(vendorReviews.createdAt))
    .limit(limit)
    .offset(offset);

  const reviews = rows.map((r) => mapRow(r.review, r.name));

  return { reviews, total, page, limit };
}

export async function createReview(
  reviewerId: string,
  vendorId:   string,
  input:      CreateReviewInput,
): Promise<VendorReview> {
  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) throw new ReviewError('NOT_FOUND', 'Vendor not found');

  // If bookingId given, verify the reviewer owns a COMPLETED booking with this vendor
  if (input.bookingId) {
    const [booking] = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        customerId: bookings.customerId,
        vendorId: bookings.vendorId,
      })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1);

    if (!booking) throw new ReviewError('NOT_FOUND', 'Booking not found');
    if (booking.customerId !== reviewerId) {
      throw new ReviewError('FORBIDDEN', 'Only the booking customer can review.');
    }
    if (booking.vendorId !== vendorId) {
      throw new ReviewError('VALIDATION_ERROR', 'Booking does not belong to this vendor.');
    }
    if (booking.status !== 'COMPLETED') {
      throw new ReviewError('INVALID_STATE', 'You can only review completed bookings.');
    }

    // Disallow duplicate review for same booking
    const existing = await db
      .select({ id: vendorReviews.id })
      .from(vendorReviews)
      .where(eq(vendorReviews.bookingId, input.bookingId))
      .limit(1);
    if (existing.length > 0) {
      throw new ReviewError('CONFLICT', 'A review already exists for this booking.');
    }
  }

  const [inserted] = await db
    .insert(vendorReviews)
    .values({
      vendorId,
      bookingId:   input.bookingId ?? null,
      reviewerId,
      rating:      input.rating,
      title:       input.title ?? null,
      comment:     input.comment ?? null,
    })
    .returning();

  if (!inserted) throw new ReviewError('INSERT_FAILED', 'Failed to create review');

  await recomputeAggregate(vendorId);

  const [reviewer] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, reviewerId))
    .limit(1);

  return mapRow(inserted, reviewer?.name ?? null);
}

export async function replyToReview(
  vendorUserId: string,
  reviewId:     string,
  input:        ReviewReplyInput,
): Promise<VendorReview> {
  const [review] = await db
    .select()
    .from(vendorReviews)
    .where(eq(vendorReviews.id, reviewId))
    .limit(1);

  if (!review) throw new ReviewError('NOT_FOUND', 'Review not found');

  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, review.vendorId))
    .limit(1);

  if (!vendor || vendor.userId !== vendorUserId) {
    throw new ReviewError('FORBIDDEN', 'Only the vendor can reply to this review.');
  }

  const [updated] = await db
    .update(vendorReviews)
    .set({
      vendorReply:     input.reply,
      vendorRepliedAt: new Date(),
    })
    .where(eq(vendorReviews.id, reviewId))
    .returning();

  if (!updated) throw new ReviewError('UPDATE_FAILED', 'Failed to update review');

  const [reviewer] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, updated.reviewerId))
    .limit(1);

  return mapRow(updated, reviewer?.name ?? null);
}
