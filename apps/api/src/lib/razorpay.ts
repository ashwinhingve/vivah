/**
 * Razorpay client — real SDK with idempotent retries, mock fallback.
 *
 * USE_MOCK_SERVICES=true short-circuits to deterministic stubs (dev/test).
 * USE_MOCK_SERVICES=false uses the official `razorpay` Node SDK.
 *
 * verifyWebhookSignature/verifyPaymentSignature use HMAC-SHA256 with
 * constant-time comparison. Webhook verification supports rotation:
 * RAZORPAY_WEBHOOK_SECRETS=current,previous (comma-separated) accepts both.
 */

import { env } from './env.js';
import { createHmac, timingSafeEqual } from 'crypto';

const USE_MOCK = env.USE_MOCK_SERVICES;

// Minimal shape of the razorpay Node SDK we actually call. The official
// `razorpay` package ships only partial types, so this internal interface
// keeps the rest of the file fully typed without `any` casts.
interface RazorpaySdk {
  orders:        { create(opts: Record<string, unknown>): Promise<unknown> };
  payments:      {
    refund(paymentId: string, opts: Record<string, unknown>): Promise<unknown>;
    fetch(paymentId: string): Promise<unknown>;
  };
  transfers:     { create(opts: Record<string, unknown>): Promise<unknown> };
  paymentLink:   { create(opts: Record<string, unknown>): Promise<unknown> };
  qrCode:        { create(opts: Record<string, unknown>): Promise<unknown> };
  plans:         { create(opts: Record<string, unknown>): Promise<unknown> };
  subscriptions: {
    create(opts: Record<string, unknown>): Promise<unknown>;
    cancel(id: string, atCycleEnd?: boolean): Promise<unknown>;
    fetch(id: string): Promise<unknown>;
  };
}

interface RazorpayCtor {
  new (opts: { key_id: string; key_secret: string }): RazorpaySdk;
}

let sdk: RazorpaySdk | null = null;
async function getSdk(): Promise<RazorpaySdk> {
  if (sdk) return sdk;
  if (USE_MOCK) throw new Error('Razorpay SDK not available in mock mode');
  const mod = (await import('razorpay')) as unknown as { default: RazorpayCtor };
  const Razorpay = mod.default;
  sdk = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return sdk;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { statusCode?: number }).statusCode ?? 0;
      if (status < 500 && status !== 0 && status !== 429) break;
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RazorpayOrder {
  id:       string;
  amount:   number;
  currency: string;
  status:   string;
}

export interface RazorpayRefund {
  id:     string;
  amount: number;
  status: string;
}

export interface RazorpayPaymentLink {
  id:         string;
  short_url:  string;
  status:     string;
  amount:     number;
  expires_at: number;
}

export interface RazorpayTransfer {
  id:      string;
  amount?: number;
  status?: string;
}

export interface RazorpaySubscription {
  id:                 string;
  status:             string;
  current_start?:     number;
  current_end?:       number;
  short_url?:         string;
  plan_id?:           string;
}

export interface RazorpayPlan {
  id:        string;
  period:    string;
  interval:  number;
  item:      { name: string; amount: number; currency: string };
  status:    string;
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function createOrder(
  amount: number,
  currency = 'INR',
  receipt: string,
  notes?: Record<string, string>,
): Promise<RazorpayOrder> {
  if (USE_MOCK) {
    return { id: `mock_order_${Date.now()}`, amount, currency, status: 'created' };
  }
  return withRetry(async () => {
    const r = await (await getSdk()).orders.create({
      amount,
      currency,
      receipt,
      notes:        notes ?? {},
      payment_capture: true,
    });
    return r as unknown as RazorpayOrder;
  });
}

// ── Signatures ────────────────────────────────────────────────────────────────

function hmacHex(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  if (USE_MOCK) return true;
  const secrets = (env.RAZORPAY_WEBHOOK_SECRETS || env.RAZORPAY_WEBHOOK_SECRET)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (secrets.length === 0) throw new Error('RAZORPAY_WEBHOOK_SECRET(S) unset');
  for (const secret of secrets) {
    if (constantTimeEqualHex(hmacHex(secret, body), signature)) return true;
  }
  return false;
}

/** Verify Checkout.js return signature: HMAC-SHA256("{order_id}|{payment_id}", key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (USE_MOCK) return true;
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = hmacHex(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
  return constantTimeEqualHex(expected, signature);
}

// ── Refunds ───────────────────────────────────────────────────────────────────

export async function createRefund(
  paymentId: string,
  amount: number,
  notes?: Record<string, string>,
): Promise<RazorpayRefund> {
  if (USE_MOCK) {
    return { id: `mock_refund_${Date.now()}`, amount, status: 'processed' };
  }
  return withRetry(async () => {
    const r = await (await getSdk()).payments.refund(paymentId, {
      amount,
      speed: 'normal',
      notes: notes ?? {},
    });
    return r as unknown as RazorpayRefund;
  });
}

// ── Vendor payouts (Razorpay Route transfers) ────────────────────────────────

export async function transferToVendor(
  vendorAccountId: string,
  amount: number,
  notes?: Record<string, string>,
): Promise<RazorpayTransfer> {
  if (USE_MOCK) return { id: `mock_transfer_${Date.now()}`, amount, status: 'processed' };
  return withRetry(async () => {
    const r = await (await getSdk()).transfers.create({
      account:  vendorAccountId,
      amount,
      currency: 'INR',
      notes:    notes ?? {},
    });
    return r as unknown as RazorpayTransfer;
  });
}

// ── Payment Links ─────────────────────────────────────────────────────────────

export interface CreatePaymentLinkArgs {
  amount:        number;
  description:   string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  expiresAt?:    Date;
  reference?:    string;
}

export async function createPaymentLink(args: CreatePaymentLinkArgs): Promise<RazorpayPaymentLink> {
  if (USE_MOCK) {
    const id = `mock_plink_${Date.now()}`;
    return {
      id,
      short_url:  `https://rzp.io/l/${id}`,
      status:     'created',
      amount:     args.amount,
      expires_at: args.expiresAt ? Math.floor(args.expiresAt.getTime() / 1000) : 0,
    };
  }
  return withRetry(async () => {
    const customer = args.customerName || args.customerEmail || args.customerPhone
      ? {
          name:    args.customerName  ?? '',
          email:   args.customerEmail ?? '',
          contact: args.customerPhone ?? '',
        }
      : undefined;
    const r = await (await getSdk()).paymentLink.create({
      amount:        args.amount,
      currency:      'INR',
      description:   args.description,
      customer,
      expire_by:     args.expiresAt ? Math.floor(args.expiresAt.getTime() / 1000) : undefined,
      reference_id:  args.reference,
      notify:        { sms: !!args.customerPhone, email: !!args.customerEmail },
      reminder_enable: true,
    } as never);
    return r as unknown as RazorpayPaymentLink;
  });
}

// ── UPI QR ────────────────────────────────────────────────────────────────────

export async function createUpiQr(amount: number, name: string): Promise<{ id: string; qrUrl: string }> {
  if (USE_MOCK) {
    const id = `mock_qr_${Date.now()}`;
    return { id, qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?am=${amount}` };
  }
  const r = await (await getSdk()).qrCode.create({
    type:        'upi_qr',
    name,
    usage:       'single_use',
    fixed_amount: true,
    payment_amount: amount,
  } as never) as unknown as { id: string; image_url: string };
  return { id: r.id, qrUrl: r.image_url };
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export async function createPlan(input: {
  period:  'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  amount:   number;
  name:     string;
}): Promise<RazorpayPlan> {
  if (USE_MOCK) {
    return {
      id:       `mock_plan_${Date.now()}`,
      period:   input.period,
      interval: input.interval,
      item:     { name: input.name, amount: input.amount, currency: 'INR' },
      status:   'created',
    };
  }
  const r = await (await getSdk()).plans.create({
    period:   input.period,
    interval: input.interval,
    item:     { name: input.name, amount: input.amount, currency: 'INR' },
  });
  return r as unknown as RazorpayPlan;
}

export async function createSubscription(input: {
  planId:        string;
  totalCount?:   number;
  customerNotify?: boolean;
  notes?:        Record<string, string>;
}): Promise<RazorpaySubscription> {
  if (USE_MOCK) {
    return {
      id:        `mock_sub_${Date.now()}`,
      status:    'created',
      plan_id:   input.planId,
      short_url: `https://rzp.io/i/${Date.now()}`,
    };
  }
  return withRetry(async () => {
    const r = await (await getSdk()).subscriptions.create({
      plan_id:        input.planId,
      total_count:    input.totalCount ?? 12,
      customer_notify: input.customerNotify === false ? 0 : 1,
      notes:          input.notes ?? {},
    });
    return r as unknown as RazorpaySubscription;
  });
}

export async function cancelSubscription(subscriptionId: string, atCycleEnd = true): Promise<RazorpaySubscription> {
  if (USE_MOCK) {
    return { id: subscriptionId, status: atCycleEnd ? 'active' : 'cancelled' };
  }
  const r = await (await getSdk()).subscriptions.cancel(subscriptionId, atCycleEnd);
  return r as unknown as RazorpaySubscription;
}

export async function fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription | null> {
  if (USE_MOCK) {
    return { id: subscriptionId, status: 'active' };
  }
  try {
    const r = await (await getSdk()).subscriptions.fetch(subscriptionId);
    return r as unknown as RazorpaySubscription;
  } catch {
    return null;
  }
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function fetchPayment(paymentId: string): Promise<{ id: string; status: string; amount: number; method?: string } | null> {
  if (USE_MOCK) return { id: paymentId, status: 'captured', amount: 0 };
  try {
    const r = await (await getSdk()).payments.fetch(paymentId);
    return r as unknown as { id: string; status: string; amount: number; method?: string };
  } catch {
    return null;
  }
}

// ── Settlements ────────────────────────────────────────────────────────────────

export interface RazorpaySettlementItem {
  payment_id:    string;
  settlement_id: string;
  type:          string;
  amount:        number;
  fee:           number;
  tax:           number;
  settled_at:    number;
  description?:  string;
}

export async function fetchSettlements(from: number, to: number): Promise<RazorpaySettlementItem[]> {
  if (USE_MOCK) {
    return [];
  }
  const keyId     = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  const auth      = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const url       = `https://api.razorpay.com/v1/settlements/recon/combined?from=${from}&to=${to}&count=1000`;
  const res       = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) return [];
  const body = await res.json() as { items?: RazorpaySettlementItem[] };
  return body.items ?? [];
}
