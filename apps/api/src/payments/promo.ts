/**
 * Smart Shaadi — Promo Code Service.
 *
 * Discount engine for bookings, store orders, and wedding packages.
 * Per-user limit + global usage cap + first-time-user gating + scope filtering.
 */
import { eq, and, sql, desc, gt, lt, or, isNull } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import { appendAuditLog } from './service.js';
import type { CreatePromoInput, PromoApplyInput } from '@smartshaadi/schemas';

export class PromoError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'PromoError';
  }
}

export interface PromoQuoteResult {
  promoId:     string;
  code:        string;
  discount:    number;
  finalAmount: number;
}

export async function quotePromo(
  userId: string,
  input: PromoApplyInput,
): Promise<PromoQuoteResult> {
  const code = input.code.toUpperCase();
  const now  = new Date();

  const [promo] = await db
    .select()
    .from(schema.promoCodes)
    .where(
      and(
        eq(schema.promoCodes.code, code),
        eq(schema.promoCodes.isActive, true),
        lt(schema.promoCodes.validFrom, now),
        or(isNull(schema.promoCodes.validUntil), gt(schema.promoCodes.validUntil, now)),
      ),
    )
    .limit(1);

  if (!promo) throw new PromoError('NOT_FOUND', 'Invalid or expired promo code');

  if (promo.scope !== 'ALL' && promo.scope !== input.scope) {
    throw new PromoError('SCOPE_MISMATCH', `This code applies to ${promo.scope}, not ${input.scope}`);
  }

  const minOrder = parseFloat(promo.minOrderAmount);
  if (input.amount < minOrder) {
    throw new PromoError('MIN_ORDER', `Minimum order ₹${minOrder} required`);
  }

  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    throw new PromoError('USAGE_LIMIT', 'This code has reached its usage limit');
  }

  const [countRow] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(schema.promoRedemptions)
    .where(
      and(
        eq(schema.promoRedemptions.promoId, promo.id),
        eq(schema.promoRedemptions.userId, userId),
      ),
    );
  if (Number(countRow?.count ?? 0) >= promo.perUserLimit) {
    throw new PromoError('PER_USER_LIMIT', 'You have already used this code');
  }

  if (promo.firstTimeUserOnly) {
    const [b] = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(eq(schema.bookings.customerId, userId))
      .limit(1);
    if (b) throw new PromoError('FIRST_TIME_ONLY', 'This code is for first-time users only');
  }

  const value = parseFloat(promo.value);
  let discount: number;
  if (promo.type === 'PERCENT') {
    discount = (input.amount * value) / 100;
    if (promo.maxDiscount !== null) {
      discount = Math.min(discount, parseFloat(promo.maxDiscount));
    }
  } else {
    discount = value;
  }
  discount    = Math.min(discount, input.amount);
  discount    = Math.round(discount * 100) / 100;
  const finalAmount = Math.max(0, Math.round((input.amount - discount) * 100) / 100);

  return { promoId: promo.id, code: promo.code, discount, finalAmount };
}

export async function redeemPromo(args: {
  userId:     string;
  promoId:    string;
  discount:   number;
  bookingId?: string;
  orderId?:   string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.promoCodes)
      .set({ usedCount: sql`${schema.promoCodes.usedCount} + 1` })
      .where(eq(schema.promoCodes.id, args.promoId))
      .returning();
    if (!updated) throw new PromoError('NOT_FOUND', 'Promo gone');

    await tx
      .insert(schema.promoRedemptions)
      .values({
        promoId:   args.promoId,
        userId:    args.userId,
        bookingId: args.bookingId ?? null,
        orderId:   args.orderId ?? null,
        discount:  String(args.discount),
      });
  });

  await appendAuditLog({
    eventType:  'PROMO_REDEEMED',
    entityType: 'promo',
    entityId:   args.promoId,
    actorId:    args.userId,
    payload:    { discount: args.discount, bookingId: args.bookingId ?? null, orderId: args.orderId ?? null },
  });
}

export async function listActivePromos(scope?: 'BOOKING' | 'STORE' | 'WEDDING') {
  const now  = new Date();
  return db
    .select()
    .from(schema.promoCodes)
    .where(
      and(
        eq(schema.promoCodes.isActive, true),
        lt(schema.promoCodes.validFrom, now),
        or(isNull(schema.promoCodes.validUntil), gt(schema.promoCodes.validUntil, now)),
        scope
          ? or(eq(schema.promoCodes.scope, scope), eq(schema.promoCodes.scope, 'ALL'))
          : undefined,
      ),
    )
    .orderBy(desc(schema.promoCodes.createdAt))
    .limit(50);
}

export async function adminCreatePromo(adminId: string, input: CreatePromoInput) {
  const [admin] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminId))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') throw new PromoError('FORBIDDEN', 'Admin role required');

  const [promo] = await db
    .insert(schema.promoCodes)
    .values({
      code:               input.code.toUpperCase(),
      description:        input.description ?? null,
      type:               input.type,
      value:              String(input.value),
      scope:              input.scope,
      minOrderAmount:     String(input.minOrderAmount),
      maxDiscount:        input.maxDiscount !== undefined ? String(input.maxDiscount) : null,
      usageLimit:         input.usageLimit ?? null,
      perUserLimit:       input.perUserLimit,
      validFrom:          input.validFrom ? new Date(input.validFrom) : new Date(),
      validUntil:         input.validUntil ? new Date(input.validUntil) : null,
      firstTimeUserOnly:  input.firstTimeUserOnly,
      createdBy:          adminId,
    })
    .returning();
  return promo!;
}

export async function adminDeactivatePromo(adminId: string, code: string) {
  const [admin] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminId))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') throw new PromoError('FORBIDDEN', 'Admin role required');

  await db
    .update(schema.promoCodes)
    .set({ isActive: false })
    .where(eq(schema.promoCodes.code, code.toUpperCase()));
}
