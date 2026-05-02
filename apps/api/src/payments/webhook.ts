/**
 * Smart Shaadi — Razorpay Webhook Handler
 *
 * NO authenticate() middleware — verified by Razorpay HMAC signature only.
 * Raw body is required for signature verification: use express.raw() on this route.
 *
 * Idempotency: every delivery is recorded in `webhook_events` keyed by
 * (provider, event_id). Replays short-circuit before any side-effect fires.
 */
import type { Request, Response } from 'express';
import { verifyWebhookSignature } from '../lib/razorpay.js';
import {
  handlePaymentSuccess,
  markBookingDisputed,
  handlePaymentFailed,
} from './service.js';
import { recordWebhookEvent, markProcessed, markFailed, markIgnored } from './webhookEvents.js';
import { markLinkPaid } from './paymentLinks.js';
import { logger } from '../lib/logger.js';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import { eq, desc } from 'drizzle-orm';

interface RazorpayPaymentEntity { id: string; order_id: string; status?: string; error_code?: string; error_description?: string; }
interface RazorpayRefundEntity  { id: string; payment_id: string; amount?: number; }
interface RazorpayDisputeEntity { id: string; payment_id: string; }
interface RazorpayPaymentLinkEntity { id: string; status: string; payment_id?: string; }
interface RazorpaySubscriptionEntity {
  id:               string;
  status:           string;
  current_start?:   number;
  current_end?:     number;
  charge_at?:       number;
  notes?:           Record<string, string>;
}
interface RazorpayPayoutEntity {
  id:               string;
  status:           string;
  failure_reason?:  string;
  notes?:           Record<string, string>;
}

interface WebhookPayload {
  event: string;
  created_at?: number;
  payload: {
    payment?:       { entity: RazorpayPaymentEntity };
    refund?:        { entity: RazorpayRefundEntity };
    dispute?:       { entity: RazorpayDisputeEntity };
    payment_link?:  { entity: RazorpayPaymentLinkEntity };
    subscription?:  { entity: RazorpaySubscriptionEntity };
    payout?:        { entity: RazorpayPayoutEntity };
  };
  // Razorpay sends top-level x-razorpay-event-id header; if not, use a digest fallback
}

// Reject webhooks older than this — replay attack defence.
const MAX_EVENT_AGE_SECONDS = 7 * 24 * 60 * 60;

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  const rawBody =
    Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

  const signature = req.headers['x-razorpay-signature'];
  if (typeof signature !== 'string') {
    res.status(400).json({ success: false, error: 'Missing signature header' });
    return;
  }

  const isValid = await verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    res.status(400).json({ success: false, error: 'Invalid signature' });
    return;
  }

  let event: WebhookPayload;
  try {
    event = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    res.status(400).json({ success: false, error: 'Invalid JSON body' });
    return;
  }

  // Replay-age guard — reject events older than MAX_EVENT_AGE_SECONDS.
  if (typeof event.created_at === 'number') {
    const ageSec = Math.floor(Date.now() / 1000) - event.created_at;
    if (ageSec > MAX_EVENT_AGE_SECONDS) {
      console.warn('[webhook] dropping stale event:', event.event, 'age:', ageSec, 's');
      res.status(202).json({ success: true, dropped: 'too_old' });
      return;
    }
  }

  const headerEventId = req.headers['x-razorpay-event-id'];
  const eventId =
    typeof headerEventId === 'string'
      ? headerEventId
      : `${event.event}-${signature.slice(0, 16)}`;

  // Persist + dedup before any handler runs.
  let recorded;
  try {
    recorded = await recordWebhookEvent({
      eventId,
      eventType: event.event,
      payload:   event,
      signature,
    });
  } catch (e) {
    logger.error({ err: e }, '[webhook] failed to record event');
    res.status(500).json({ success: false });
    return;
  }

  if (recorded.duplicate) {
    res.json({ success: true, duplicate: true });
    return;
  }

  try {
    switch (event.event) {
      case 'payment.captured':
      case 'order.paid': {
        const entity = event.payload.payment?.entity;
        if (entity) {
          // Wallet top-up path — order created with notes.kind='WALLET_TOPUP'.
          const notes = (entity as { notes?: Record<string, string> }).notes ?? {};
          if (notes['kind'] === 'WALLET_TOPUP' && notes['userId']) {
            const amount = (entity as { amount?: number }).amount ?? 0;
            const { creditWalletForTopup } = await import('./wallet.js');
            await creditWalletForTopup(notes['userId'], Math.round(amount / 100), entity.id).catch((err) => {
              logger.error({ err, userId: notes['userId'], amount }, '[webhook] wallet topup credit failed');
            });
          } else {
            await handlePaymentSuccess(entity.order_id, entity.id);
          }
        }
        await markProcessed(recorded.id);
        break;
      }

      case 'payment.failed': {
        const entity = event.payload.payment?.entity;
        if (entity) {
          await handlePaymentFailed(
            entity.order_id,
            entity.error_code ?? 'UNKNOWN',
            entity.error_description ?? 'Payment failed at gateway',
          );
        }
        await markProcessed(recorded.id);
        break;
      }

      case 'refund.processed': {
        const entity = event.payload.refund?.entity;
        if (entity) {
          const [payment] = await db
            .select()
            .from(schema.payments)
            .where(eq(schema.payments.razorpayPaymentId, entity.payment_id));
          if (payment) {
            // If a refunds row matches, mark COMPLETED. Else update payment status only.
            const [match] = await db
              .select()
              .from(schema.refunds)
              .where(eq(schema.refunds.razorpayRefundId, entity.id))
              .limit(1);
            if (match && match.status !== 'COMPLETED') {
              await db
                .update(schema.refunds)
                .set({ status: 'COMPLETED', processedAt: new Date() })
                .where(eq(schema.refunds.id, match.id));
            }
            // Roll-up
            if (payment.status !== 'REFUNDED') {
              await db
                .update(schema.payments)
                .set({ status: payment.status === 'PARTIALLY_REFUNDED' ? 'PARTIALLY_REFUNDED' : 'REFUNDED' })
                .where(eq(schema.payments.id, payment.id));
            }
          }
        }
        await markProcessed(recorded.id);
        break;
      }

      case 'refund.failed': {
        const entity = event.payload.refund?.entity;
        if (entity) {
          const [match] = await db
            .select()
            .from(schema.refunds)
            .where(eq(schema.refunds.razorpayRefundId, entity.id))
            .limit(1);
          if (match) {
            await db
              .update(schema.refunds)
              .set({ status: 'FAILED', failureReason: 'Razorpay refund.failed event' })
              .where(eq(schema.refunds.id, match.id));
          }
        }
        await markProcessed(recorded.id);
        break;
      }

      case 'dispute.created':
      case 'payment.dispute.created': {
        const entity = event.payload.dispute?.entity;
        if (entity) {
          const [payment] = await db
            .select()
            .from(schema.payments)
            .where(eq(schema.payments.razorpayPaymentId, entity.payment_id))
            .orderBy(desc(schema.payments.createdAt))
            .limit(1);
          if (payment) await markBookingDisputed(payment.bookingId);
        }
        await markProcessed(recorded.id);
        break;
      }

      case 'payment_link.paid': {
        const entity = event.payload.payment_link?.entity;
        if (entity?.payment_id) await markLinkPaid(entity.id, entity.payment_id);
        await markProcessed(recorded.id);
        break;
      }

      case 'payment_link.expired':
      case 'payment_link.cancelled': {
        const entity = event.payload.payment_link?.entity;
        if (entity) {
          await db.update(schema.paymentLinks)
            .set({ status: event.event === 'payment_link.cancelled' ? 'CANCELLED' : 'EXPIRED' })
            .where(eq(schema.paymentLinks.razorpayLinkId, entity.id));
        }
        await markProcessed(recorded.id);
        break;
      }

      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.completed':
      case 'subscription.cancelled':
      case 'subscription.paused':
      case 'subscription.resumed':
      case 'subscription.halted':
      case 'subscription.pending': {
        // Subscription handler is implemented in payments/subscriptions.ts
        // when present; webhook just records + delegates.
        try {
          const sub = event.payload.subscription?.entity;
          if (sub) {
            const mod = await import('./subscriptions.js').catch(() => null);
            if (mod && typeof mod.handleSubscriptionEvent === 'function') {
              await mod.handleSubscriptionEvent(event.event, sub);
            }
          }
        } catch (err) {
          console.warn('[webhook] subscription handler error:', err);
        }
        await markProcessed(recorded.id);
        break;
      }

      case 'payout.processed':
      case 'payout.reversed':
      case 'payout.failed': {
        const entity = event.payload.payout?.entity;
        if (entity) {
          const status: 'COMPLETED' | 'FAILED' =
            event.event === 'payout.processed' ? 'COMPLETED' : 'FAILED';
          await db.update(schema.payouts)
            .set({
              status,
              ...(entity.failure_reason ? { failureReason: entity.failure_reason } : {}),
              ...(event.event === 'payout.processed' ? { processedAt: new Date() } : {}),
            })
            .where(eq(schema.payouts.razorpayTransferId, entity.id));
        }
        await markProcessed(recorded.id);
        break;
      }

      case 'dispute.won':
      case 'dispute.lost':
      case 'dispute.closed':
      case 'dispute.under_review': {
        // Just record — admin reconciles via dispute resolution flow.
        await markProcessed(recorded.id);
        break;
      }

      default:
        await markIgnored(recorded.id);
        break;
    }

    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ err: error, eventId: recorded.id }, '[webhook] processing error');
    await markFailed(recorded.id, msg).catch(() => undefined);
    res.status(500).json({ success: false, error: 'Internal processing error' });
  }
}
