import type { Request, Response } from 'express';
import * as razorpay from '../lib/razorpay.js';
import { confirmOrder } from './order.service.js';
import { err } from '../lib/response.js';
import { recordWebhookEvent, markProcessed, markFailed } from '../payments/webhookEvents.js';
import { logger } from '../lib/logger.js';

/**
 * Razorpay webhook for e-commerce orders.
 * Mounted in index.ts with express.raw() BEFORE express.json() so the raw
 * bytes that Razorpay signed are available verbatim for signature verification.
 */
export async function storeWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-razorpay-signature'];
  if (typeof signature !== 'string') {
    err(res, 'UNAUTHORIZED', 'Missing Razorpay signature', 401);
    return;
  }

  const rawBody =
    Buffer.isBuffer(req.body) ? req.body.toString('utf8') :
    typeof req.body === 'string' ? req.body :
    JSON.stringify(req.body);

  const valid = await razorpay.verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    err(res, 'UNAUTHORIZED', 'Invalid Razorpay signature', 401);
    return;
  }

  let body: {
    event?: string;
    payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    err(res, 'BAD_REQUEST', 'Invalid JSON body', 400);
    return;
  }

  // Idempotency — record + dedup before confirmOrder runs. Razorpay retries
  // on any non-2xx and occasionally on 2xx (network blips); without this guard
  // a single capture could create N orders or trigger N fulfilments.
  const eventType = body.event ?? 'unknown';
  const headerEventId = req.headers['x-razorpay-event-id'];
  const eventId =
    typeof headerEventId === 'string'
      ? `store:${headerEventId}`
      : `store:${eventType}-${signature.slice(0, 16)}`;

  let recorded;
  try {
    recorded = await recordWebhookEvent({
      provider:  'razorpay-store',
      eventId,
      eventType,
      payload:   body,
      signature,
    });
  } catch (e) {
    logger.error({ err: e }, '[store/webhook] failed to record event');
    err(res, 'INTERNAL', 'Webhook recording failed', 500);
    return;
  }

  if (recorded.duplicate) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  if (body.event === 'payment.captured') {
    const razorpayOrderId   = body.payload?.payment?.entity?.order_id ?? '';
    const razorpayPaymentId = body.payload?.payment?.entity?.id        ?? '';
    if (razorpayOrderId && razorpayPaymentId) {
      try {
        await confirmOrder(razorpayOrderId, razorpayPaymentId);
      } catch (e) {
        await markFailed(recorded.id, e instanceof Error ? e.message : String(e));
        logger.error({ err: e, eventId }, '[store/webhook/razorpay] confirmOrder failed');
        // Respond 200 anyway — duplicate guard will short-circuit retries.
        res.status(200).json({ received: true, error: true });
        return;
      }
    }
  }

  await markProcessed(recorded.id);
  res.status(200).json({ received: true });
}
