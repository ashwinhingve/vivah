import type { Request, Response } from 'express';
import * as razorpay from '../lib/razorpay.js';
import { confirmOrder } from './order.service.js';
import { err } from '../lib/response.js';

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

  if (body.event === 'payment.captured') {
    const razorpayOrderId   = body.payload?.payment?.entity?.order_id ?? '';
    const razorpayPaymentId = body.payload?.payment?.entity?.id        ?? '';
    if (razorpayOrderId && razorpayPaymentId) {
      try {
        await confirmOrder(razorpayOrderId, razorpayPaymentId);
      } catch (e) {
        // Log but respond 200 — Razorpay will retry on 5xx; we prefer
        // idempotent noop to looped retries.
        console.error('[store/webhook/razorpay] confirmOrder failed:', e);
      }
    }
  }

  res.status(200).json({ received: true });
}
