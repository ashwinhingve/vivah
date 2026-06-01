/**
 * Razorpay PAYMENTS webhook — record/replay harness.
 *
 * Feeds canonical fixture payloads (from __fixtures__/webhooks) to the real
 * `webhookHandler` and asserts: (a) a correctly HMAC-signed body verifies and
 * routes to the right side-effect, and (b) a tampered signature is rejected 400.
 *
 * Unlike webhook.test.ts (which mocks verifyWebhookSignature), this exercises the
 * REAL HMAC-SHA256 verification by mocking lib/env with USE_MOCK_SERVICES=false +
 * a test secret, and NOT mocking lib/razorpay. This is the safety net for the
 * real-credential swap: it proves signature verification + event routing work.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SECRET = 'whsec_test_123';

const {
  mockHandlePaymentSuccess, mockHandlePaymentFailed, mockMarkBookingDisputed,
  mockRecord, mockProcessed, mockFailed, mockIgnored, mockMarkLinkPaid,
} = vi.hoisted(() => ({
  mockHandlePaymentSuccess: vi.fn(),
  mockHandlePaymentFailed:  vi.fn(),
  mockMarkBookingDisputed:  vi.fn(),
  mockRecord:               vi.fn(),
  mockProcessed:            vi.fn(),
  mockFailed:               vi.fn(),
  mockIgnored:              vi.fn(),
  mockMarkLinkPaid:         vi.fn(),
}));

// USE_MOCK_SERVICES=false → real HMAC verification runs in lib/razorpay.
vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: false, RAZORPAY_WEBHOOK_SECRET: 'whsec_test_123', RAZORPAY_WEBHOOK_SECRETS: '' },
}));
// lib/razorpay is intentionally NOT mocked — the real verifyWebhookSignature runs.
vi.mock('../service.js', () => ({
  handlePaymentSuccess: mockHandlePaymentSuccess,
  handlePaymentFailed:  mockHandlePaymentFailed,
  markBookingDisputed:  mockMarkBookingDisputed,
}));
vi.mock('../webhookEvents.js', () => ({
  recordWebhookEvent: mockRecord,
  markProcessed:      mockProcessed,
  markFailed:         mockFailed,
  markIgnored:        mockIgnored,
}));
vi.mock('../paymentLinks.js', () => ({ markLinkPaid: mockMarkLinkPaid }));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('../../lib/db.js', () => ({
  db: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
}));

const FIX = path.join(process.cwd(), 'src/__fixtures__/webhooks');
function loadFixture(name: string): Record<string, unknown> {
  const obj = JSON.parse(readFileSync(path.join(FIX, name), 'utf8')) as Record<string, unknown>;
  obj['created_at'] = Math.floor(Date.now() / 1000); // defeat the 7-day replay-age guard
  return obj;
}
function sign(raw: Buffer): string {
  return createHmac('sha256', SECRET).update(raw).digest('hex');
}
function buildReq(raw: Buffer, sig: string, eventId = 'evt_replay_1'): Partial<Request> {
  return { body: raw, headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': eventId } };
}
function buildRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }) as unknown as Response);
  return { res: { status, json } as unknown as Response, status, json };
}

describe('payments webhook replay (real HMAC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecord.mockResolvedValue({ duplicate: false, id: 'rec-1', eventId: 'evt_replay_1', eventType: 'x' });
  });

  it('verifies a valid signature and processes payment.captured', async () => {
    const { webhookHandler } = await import('../webhook.js');
    const raw = Buffer.from(JSON.stringify(loadFixture('razorpay-payment-captured.json')));
    const { res, json } = buildRes();

    await webhookHandler(buildReq(raw, sign(raw)) as Request, res);

    expect(mockHandlePaymentSuccess).toHaveBeenCalledWith('order_TEST00000001', 'pay_TEST0000000001');
    expect(mockProcessed).toHaveBeenCalledWith('rec-1');
    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it('verifies a valid signature and processes refund.processed', async () => {
    const { webhookHandler } = await import('../webhook.js');
    const raw = Buffer.from(JSON.stringify(loadFixture('razorpay-refund-processed.json')));
    const { res, json } = buildRes();

    await webhookHandler(buildReq(raw, sign(raw)) as Request, res);

    expect(mockProcessed).toHaveBeenCalledWith('rec-1');
    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it('rejects a tampered signature with 400 before any side-effect', async () => {
    const { webhookHandler } = await import('../webhook.js');
    const raw = Buffer.from(JSON.stringify(loadFixture('razorpay-payment-captured.json')));
    const { res, status, json } = buildRes();

    await webhookHandler(buildReq(raw, 'deadbeefdeadbeef') as Request, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Invalid signature' });
    expect(mockHandlePaymentSuccess).not.toHaveBeenCalled();
    expect(mockProcessed).not.toHaveBeenCalled();
  });

  it('short-circuits a duplicate replay without re-processing', async () => {
    mockRecord.mockResolvedValue({ duplicate: true, id: 'rec-1', eventId: 'evt_replay_1', eventType: 'x' });
    const { webhookHandler } = await import('../webhook.js');
    const raw = Buffer.from(JSON.stringify(loadFixture('razorpay-payment-captured.json')));
    const { res, json } = buildRes();

    await webhookHandler(buildReq(raw, sign(raw)) as Request, res);

    expect(json).toHaveBeenCalledWith({ success: true, duplicate: true });
    expect(mockHandlePaymentSuccess).not.toHaveBeenCalled();
    expect(mockProcessed).not.toHaveBeenCalled();
  });
});
