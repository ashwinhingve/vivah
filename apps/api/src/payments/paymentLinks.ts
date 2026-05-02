/**
 * Smart Shaadi — Payment Links Service.
 *
 * Vendors / coordinators can generate Razorpay payment links shareable via
 * WhatsApp, SMS, email — useful for deposits, ad-hoc collections, top-ups.
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import * as schema from '@smartshaadi/db';
import { createPaymentLink as razorpayCreateLink } from '../lib/razorpay.js';
import { appendAuditLog } from './service.js';
import type { CreatePaymentLinkInput } from '@smartshaadi/schemas';
import { randomBytes } from 'crypto';

export class PaymentLinkError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'PaymentLinkError';
  }
}

function makeShortId(): string {
  return randomBytes(6).toString('base64url').slice(0, 10);
}

export async function createLink(userId: string, input: CreatePaymentLinkInput) {
  const expiresAt = new Date(Date.now() + input.expiryHours * 60 * 60 * 1000);
  const shortId   = makeShortId();

  const rzp = await razorpayCreateLink({
    amount:        input.amount,
    description:   input.description,
    ...(input.customerName  ? { customerName:  input.customerName  } : {}),
    ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
    ...(input.customerPhone ? { customerPhone: input.customerPhone } : {}),
    expiresAt,
  });

  const [link] = await db
    .insert(schema.paymentLinks)
    .values({
      shortId,
      amount:           String(input.amount),
      currency:         'INR',
      description:      input.description,
      customerName:     input.customerName ?? null,
      customerEmail:    input.customerEmail ?? null,
      customerPhone:    input.customerPhone ?? null,
      bookingId:        input.bookingId ?? null,
      status:           'ACTIVE',
      razorpayLinkId:   rzp.id,
      razorpayShortUrl: rzp.short_url,
      expiresAt,
      createdBy:        userId,
    })
    .returning();

  await appendAuditLog({
    eventType:  'PAYMENT_LINK_CREATED',
    entityType: 'payment_link',
    entityId:   link!.id,
    actorId:    userId,
    payload:    { amount: input.amount, expiresAt: expiresAt.toISOString(), bookingId: input.bookingId ?? null },
  });

  return link!;
}

export async function listMyLinks(userId: string) {
  return db
    .select()
    .from(schema.paymentLinks)
    .where(eq(schema.paymentLinks.createdBy, userId))
    .orderBy(desc(schema.paymentLinks.createdAt))
    .limit(50);
}

export async function getLink(userId: string, linkId: string) {
  const [link] = await db
    .select()
    .from(schema.paymentLinks)
    .where(and(eq(schema.paymentLinks.id, linkId), eq(schema.paymentLinks.createdBy, userId)))
    .limit(1);
  if (!link) throw new PaymentLinkError('NOT_FOUND', 'Payment link not found');
  return link;
}

export async function cancelLink(userId: string, linkId: string) {
  const [updated] = await db
    .update(schema.paymentLinks)
    .set({ status: 'CANCELLED' })
    .where(
      and(
        eq(schema.paymentLinks.id, linkId),
        eq(schema.paymentLinks.createdBy, userId),
        eq(schema.paymentLinks.status, 'ACTIVE'),
      ),
    )
    .returning();
  if (!updated) throw new PaymentLinkError('INVALID_STATE', 'Link not found or already finalised');
  return updated;
}

/** Mark a link PAID — invoked by webhook when paymentLink.payment.captured. */
export async function markLinkPaid(razorpayLinkId: string, razorpayPaymentId: string) {
  const [link] = await db
    .update(schema.paymentLinks)
    .set({
      status:            'PAID',
      paidAt:            new Date(),
      razorpayPaymentId,
    })
    .where(
      and(
        eq(schema.paymentLinks.razorpayLinkId, razorpayLinkId),
        eq(schema.paymentLinks.status, 'ACTIVE'),
      ),
    )
    .returning();
  if (!link) return null;

  await appendAuditLog({
    eventType:  'PAYMENT_LINK_PAID',
    entityType: 'payment_link',
    entityId:   link.id,
    actorId:    link.createdBy,
    payload:    { razorpayPaymentId, amount: link.amount },
  });

  return link;
}

/** Background sweep — marks expired ACTIVE links as EXPIRED. */
export async function expireStaleLinks(): Promise<number> {
  const now = new Date();
  const updated = await db
    .update(schema.paymentLinks)
    .set({ status: 'EXPIRED' })
    .where(
      and(
        eq(schema.paymentLinks.status, 'ACTIVE'),
        sql`${schema.paymentLinks.expiresAt} < ${now}`,
      ),
    )
    .returning({ id: schema.paymentLinks.id });

  if (updated.length > 0 && env.NODE_ENV !== 'test') {
    console.info(`[paymentLinks] expired ${updated.length} stale links`);
  }
  return updated.length;
}
