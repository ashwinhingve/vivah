/**
 * Razorpay STORE webhook — record/replay harness.
 *
 * Same intent as payments/webhook.replay.test.ts: feed the canonical store
 * fixture to the real `storeWebhookHandler` and assert real HMAC-SHA256
 * verification + correct fulfilment routing. Invalid signature → 401 (the store
 * handler uses `err(... 401)`), valid → confirmOrder + 200.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SECRET = 'whsec_test_123';

const { mockConfirmOrder, mockRecord, mockProcessed, mockFailed } = vi.hoisted(() => ({
  mockConfirmOrder: vi.fn(),
  mockRecord:       vi.fn(),
  mockProcessed:    vi.fn(),
  mockFailed:       vi.fn(),
}));

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: false, RAZORPAY_WEBHOOK_SECRET: 'whsec_test_123', RAZORPAY_WEBHOOK_SECRETS: '' },
}));
// lib/razorpay + lib/response are intentionally NOT mocked (real HMAC + real envelope).
vi.mock('../order.service.js', () => ({ confirmOrder: mockConfirmOrder }));
vi.mock('../../payments/webhookEvents.js', () => ({
  recordWebhookEvent: mockRecord,
  markProcessed:      mockProcessed,
  markFailed:         mockFailed,
}));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const FIX = path.join(process.cwd(), 'src/__fixtures__/webhooks');
function loadRaw(name: string): Buffer {
  return Buffer.from(readFileSync(path.join(FIX, name), 'utf8'));
}
function sign(raw: Buffer): string {
  return createHmac('sha256', SECRET).update(raw).digest('hex');
}
function buildReq(raw: Buffer, sig: string): Partial<Request> {
  return { body: raw, headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': 'evt_store_1' } };
}
function buildRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }) as unknown as Response);
  return { res: { status, json } as unknown as Response, status, json };
}

describe('store webhook replay (real HMAC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecord.mockResolvedValue({ duplicate: false, id: 'rec-store-1', eventId: 'store:evt_store_1', eventType: 'payment.captured' });
    mockConfirmOrder.mockResolvedValue(undefined);
  });

  it('verifies a valid signature and confirms the order', async () => {
    const { storeWebhookHandler } = await import('../webhook.js');
    const raw = loadRaw('razorpay-store-payment-captured.json');
    const { res, status, json } = buildRes();

    await storeWebhookHandler(buildReq(raw, sign(raw)) as Request, res);

    expect(mockConfirmOrder).toHaveBeenCalledWith('order_STORE0000001', 'pay_STORE000000001');
    expect(mockProcessed).toHaveBeenCalledWith('rec-store-1');
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ received: true });
  });

  it('rejects a tampered signature with 401 before fulfilment', async () => {
    const { storeWebhookHandler } = await import('../webhook.js');
    const raw = loadRaw('razorpay-store-payment-captured.json');
    const { res, status } = buildRes();

    await storeWebhookHandler(buildReq(raw, 'deadbeefdeadbeef') as Request, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(mockConfirmOrder).not.toHaveBeenCalled();
    expect(mockProcessed).not.toHaveBeenCalled();
  });
});
