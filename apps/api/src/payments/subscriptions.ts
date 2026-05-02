/**
 * Subscriptions service — Razorpay Subscriptions API integration.
 * Premium tier upgrades flow through here.
 *
 * Lifecycle:
 *   createSubscription → user pays via Checkout.js → razorpay sends
 *   subscription.activated webhook → handleSubscriptionEvent flips status
 *   to ACTIVE + invalidateTierCache → user starts seeing PREMIUM features.
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  plans,
  subscriptions,
  subscriptionCharges,
  profiles,
} from '@smartshaadi/db';
import {
  createSubscription as rzpCreateSubscription,
  cancelSubscription as rzpCancelSubscription,
  type RazorpaySubscription,
} from '../lib/razorpay.js';
import { invalidateTierCache } from '../lib/entitlements.js';
import { appendAuditLog } from './service.js';

interface ServiceError extends Error { code: string; status: number; }
function err(message: string, code: string, status: number): ServiceError {
  return Object.assign(new Error(message), { code, status });
}

export async function listPlans(): Promise<Array<{
  id:       string;
  code:     string;
  name:     string;
  tier:     string;
  interval: string;
  amount:   number;
  features: unknown;
}>> {
  const rows = await db.select().from(plans).where(eq(plans.active, true));
  return rows.map(r => ({
    id:       r.id,
    code:     r.code,
    name:     r.name,
    tier:     r.tier,
    interval: r.interval,
    amount:   Number(r.amount),
    features: r.features,
  }));
}

export async function getActiveSubscription(userId: string): Promise<{
  id:                    string;
  status:                string;
  planCode:              string;
  tier:                  string;
  currentPeriodStart:    Date | null;
  currentPeriodEnd:      Date | null;
  cancelAtPeriodEnd:     boolean;
} | null> {
  const rows = await db
    .select({
      id:                 subscriptions.id,
      status:             subscriptions.status,
      planCode:           plans.code,
      tier:               plans.tier,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd:   subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd:  subscriptions.cancelAtPeriodEnd,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function startSubscription(userId: string, planCode: string): Promise<{
  subscriptionId:     string;
  razorpaySubscriptionId: string | null;
  shortUrl:           string | null;
  status:             string;
}> {
  const [plan] = await db.select().from(plans).where(eq(plans.code, planCode));
  if (!plan) throw err('Plan not found', 'NOT_FOUND', 404);
  if (!plan.active) throw err('Plan is inactive', 'INACTIVE', 410);
  if (!plan.razorpayPlanId) throw err('Plan not provisioned with Razorpay', 'NOT_READY', 503);

  // Reject if already an active subscription.
  const existing = await getActiveSubscription(userId);
  if (existing && ['ACTIVE', 'AUTHENTICATED', 'PENDING'].includes(existing.status)) {
    throw err('You already have an active subscription', 'ALREADY_SUBSCRIBED', 409);
  }

  const rzp = await rzpCreateSubscription({
    planId:      plan.razorpayPlanId,
    totalCount:  plan.interval === 'YEARLY' ? 5 : plan.interval === 'QUARTERLY' ? 8 : 12,
    notes:       { userId, planCode },
  });

  const [row] = await db.insert(subscriptions).values({
    userId,
    planId:                 plan.id,
    razorpaySubscriptionId: rzp.id,
    status:                 (rzp.status?.toUpperCase() ?? 'CREATED') as never,
    shortUrl:               rzp.short_url ?? null,
    notes:                  { planCode },
  }).returning();

  if (!row) throw err('Failed to persist subscription', 'INTERNAL', 500);
  return {
    subscriptionId:         row.id,
    razorpaySubscriptionId: row.razorpaySubscriptionId,
    shortUrl:               row.shortUrl,
    status:                 row.status,
  };
}

export async function cancelSubscription(userId: string, subscriptionId: string, atCycleEnd = true): Promise<void> {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId));
  if (!row) throw err('Subscription not found', 'NOT_FOUND', 404);
  if (row.userId !== userId) throw err('Forbidden', 'FORBIDDEN', 403);
  if (!row.razorpaySubscriptionId) throw err('No Razorpay handle', 'INVALID_STATE', 409);

  await rzpCancelSubscription(row.razorpaySubscriptionId, atCycleEnd);

  await db.update(subscriptions)
    .set({
      cancelAtPeriodEnd: atCycleEnd,
      status:            atCycleEnd ? row.status : 'CANCELLED',
      updatedAt:         new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId));

  if (!atCycleEnd) {
    await invalidateTierCache(userId);
    await downgradeUserTier(userId);
  }
}

async function getPlanTier(subscriptionId: string): Promise<string | null> {
  const rows = await db
    .select({ tier: plans.tier })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  return rows[0]?.tier ?? null;
}

async function downgradeUserTier(userId: string): Promise<void> {
  await db.update(profiles).set({ premiumTier: 'FREE' }).where(eq(profiles.userId, userId));
}

async function upgradeUserTier(userId: string, tier: 'STANDARD' | 'PREMIUM'): Promise<void> {
  await db.update(profiles).set({ premiumTier: tier }).where(eq(profiles.userId, userId));
  invalidateTierCache(userId);
}

/**
 * Webhook entry point — invoked from payments/webhook.ts via dynamic import.
 * Each Razorpay event is mapped to a status transition + side effect.
 */
export async function handleSubscriptionEvent(eventType: string, entity: RazorpaySubscription): Promise<void> {
  const [row] = await db.select().from(subscriptions)
    .where(eq(subscriptions.razorpaySubscriptionId, entity.id));
  if (!row) {
    console.warn('[subscriptions] webhook for unknown subscription:', entity.id);
    return;
  }

  const tier = await getPlanTier(row.id);

  switch (eventType) {
    case 'subscription.activated':
    case 'subscription.charged': {
      await db.update(subscriptions).set({
        status:             'ACTIVE',
        currentPeriodStart: entity.current_start ? new Date(entity.current_start * 1000) : null,
        currentPeriodEnd:   entity.current_end   ? new Date(entity.current_end   * 1000) : null,
        gracePeriodEnd:     null,
        updatedAt:          new Date(),
      }).where(eq(subscriptions.id, row.id));

      // Record charge if the event includes payment_id.
      if (eventType === 'subscription.charged' && (entity as { payment_id?: string }).payment_id) {
        await db.insert(subscriptionCharges).values({
          subscriptionId:    row.id,
          razorpayPaymentId: (entity as { payment_id?: string }).payment_id ?? null,
          amount:            String(0),  // full amount comes via separate payment.captured event
          periodStart:       entity.current_start ? new Date(entity.current_start * 1000) : new Date(),
          periodEnd:         entity.current_end   ? new Date(entity.current_end   * 1000) : new Date(),
          status:            'CHARGED',
        }).onConflictDoNothing();
      }

      if (tier === 'STANDARD' || tier === 'PREMIUM') {
        await upgradeUserTier(row.userId, tier as 'STANDARD' | 'PREMIUM');
      }
      // Audit-log; eventType must exist in schema.auditEventTypeEnum.
      try {
        await appendAuditLog({
          eventType:  'PAYMENT_RECEIVED',
          actorId:    row.userId,
          entityId:   row.id,
          entityType: 'subscription',
          payload:    { eventType, status: entity.status ?? '' },
        });
      } catch { /* audit is best-effort */ }
      break;
    }

    case 'subscription.halted':
    case 'subscription.pending': {
      // Payment retry exhausted — start 7-day grace.
      const graceUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.update(subscriptions).set({
        status:         'HALTED',
        gracePeriodEnd: graceUntil,
        updatedAt:      new Date(),
      }).where(eq(subscriptions.id, row.id));
      break;
    }

    case 'subscription.paused': {
      await db.update(subscriptions).set({ status: 'PAUSED', updatedAt: new Date() })
        .where(eq(subscriptions.id, row.id));
      break;
    }

    case 'subscription.resumed': {
      await db.update(subscriptions).set({ status: 'ACTIVE', updatedAt: new Date() })
        .where(eq(subscriptions.id, row.id));
      break;
    }

    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.expired': {
      await db.update(subscriptions).set({
        status:             eventType === 'subscription.completed' ? 'COMPLETED'
                          : eventType === 'subscription.expired'   ? 'EXPIRED'
                          : 'CANCELLED',
        updatedAt:          new Date(),
      }).where(eq(subscriptions.id, row.id));
      await downgradeUserTier(row.userId);
      invalidateTierCache(row.userId);
      break;
    }
  }
}

/**
 * Cron-friendly: drops users out of paid tier when grace period ends.
 * Should be scheduled daily.
 */
export async function expireGracePeriods(): Promise<{ expired: number }> {
  const now = new Date();
  const expired = await db
    .select({ id: subscriptions.id, userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'HALTED'));

  let count = 0;
  for (const r of expired) {
    const [s] = await db.select().from(subscriptions).where(eq(subscriptions.id, r.id));
    if (s?.gracePeriodEnd && s.gracePeriodEnd < now) {
      await db.update(subscriptions).set({ status: 'EXPIRED', updatedAt: new Date() })
        .where(eq(subscriptions.id, r.id));
      await downgradeUserTier(r.userId);
      invalidateTierCache(r.userId);
      count++;
    }
  }
  return { expired: count };
}
