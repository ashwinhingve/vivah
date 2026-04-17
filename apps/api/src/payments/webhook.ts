/**
 * Smart Shaadi — Razorpay Webhook Handler
 *
 * NO authenticate() middleware — verified by Razorpay HMAC signature only.
 * Raw body is required for signature verification: use express.raw() on this route.
 */
import type { Request, Response } from 'express';
import { verifyWebhookSignature } from '../lib/razorpay.js';
import {
  handlePaymentSuccess,
  markBookingDisputed,
} from './service.js';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import { eq, desc } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Internal types for Razorpay webhook payloads
// ---------------------------------------------------------------------------
interface RazorpayPaymentEntity {
  id:       string;
  order_id: string;
}

interface RazorpayRefundEntity {
  id:         string;
  payment_id: string;
}

interface RazorpayDisputeEntity {
  id:         string;
  payment_id: string;
}

interface WebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?:  { entity: RazorpayRefundEntity };
    dispute?: { entity: RazorpayDisputeEntity };
  };
}

// ---------------------------------------------------------------------------
// webhookHandler — exported for router, NO authenticate()
// ---------------------------------------------------------------------------
export async function webhookHandler(req: Request, res: Response): Promise<void> {
  // 1. Get raw body — express.raw() on this route gives req.body as Buffer
  const rawBody =
    Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

  // 2. Get Razorpay signature
  const signature = req.headers['x-razorpay-signature'];
  if (typeof signature !== 'string') {
    res.status(400).json({ success: false, error: 'Missing signature header' });
    return;
  }

  // 3. Verify signature
  const isValid = await verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    res.status(400).json({ success: false, error: 'Invalid signature' });
    return;
  }

  // 4. Parse event
  let event: WebhookPayload;
  try {
    event = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    res.status(400).json({ success: false, error: 'Invalid JSON body' });
    return;
  }

  // 5. Handle event types
  try {
    switch (event.event) {
      case 'payment.captured': {
        const entity = event.payload.payment?.entity;
        if (entity) {
          await handlePaymentSuccess(entity.order_id, entity.id);
        }
        break;
      }

      case 'refund.processed': {
        const entity = event.payload.refund?.entity;
        if (entity) {
          // Find payment by razorpayPaymentId and mark REFUNDED
          const [payment] = await db
            .select()
            .from(schema.payments)
            .where(eq(schema.payments.razorpayPaymentId, entity.payment_id));

          if (payment) {
            await db
              .update(schema.payments)
              .set({ status: 'REFUNDED' })
              .where(eq(schema.payments.id, payment.id));
          }
        }
        break;
      }

      case 'dispute.created': {
        const entity = event.payload.dispute?.entity;
        if (entity) {
          // Find booking via payment
          const [payment] = await db
            .select()
            .from(schema.payments)
            .where(eq(schema.payments.razorpayPaymentId, entity.payment_id))
            .orderBy(desc(schema.payments.createdAt))
            .limit(1);

          if (payment) {
            await markBookingDisputed(payment.bookingId);
          }
        }
        break;
      }

      default:
        // Unknown event — acknowledge without action
        break;
    }

    res.json({ success: true });
  } catch (error) {
    // Log but still ack to prevent Razorpay retries for non-retryable errors
    console.error('[webhook] processing error:', error);
    res.status(500).json({ success: false, error: 'Internal processing error' });
  }
}
