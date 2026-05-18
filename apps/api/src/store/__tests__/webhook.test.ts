/**
 * Store Razorpay webhook handler — unit tests.
 * All deps mocked; no real I/O. Covers the audit fix: confirmOrder failure
 * must return non-2xx (500) so Razorpay retries; success returns 200.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { mockVerify, mockConfirmOrder, mockRecord, mockProcessed, mockFailed } =
  vi.hoisted(() => ({
    mockVerify:       vi.fn(),
    mockConfirmOrder: vi.fn(),
    mockRecord:       vi.fn(),
    mockProcessed:    vi.fn(),
    mockFailed:       vi.fn(),
  }));

vi.mock('../../lib/razorpay.js', () => ({
  verifyWebhookSignature: mockVerify,
}));
vi.mock('../order.service.js', () => ({
  confirmOrder: mockConfirmOrder,
}));
vi.mock('../../payments/webhookEvents.js', () => ({
  recordWebhookEvent: mockRecord,
  markProcessed:      mockProcessed,
  markFailed:         mockFailed,
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('../../lib/response.js', () => ({
  err: vi.fn((res: Response, _c: string, _m: string, s: number) => {
    res.status(s).json({ error: true });
  }),
}));

import { storeWebhookHandler } from '../webhook.js';

function makeReq(): Request {
  const body = Buffer.from(
    JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: 'order_1', id: 'pay_1' } } },
    }),
  );
  return {
    headers: {
      'x-razorpay-signature': 'sig',
      'x-razorpay-event-id':  'evt_1',
    },
    body,
  } as unknown as Request;
}

interface ResCapture {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  _status?: number;
  _json?: unknown;
}

function makeRes(): ResCapture {
  const res: ResCapture = { status: vi.fn(), json: vi.fn() };
  res.status.mockImplementation((s: number) => { res._status = s; return res; });
  res.json.mockImplementation((j: unknown) => { res._json = j; return res; });
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockResolvedValue(true);
  mockRecord.mockResolvedValue({ id: 'rec_1', duplicate: false });
  mockProcessed.mockResolvedValue(undefined);
  mockFailed.mockResolvedValue(undefined);
});

describe('storeWebhookHandler', () => {
  it('returns 500 when confirmOrder fails (so Razorpay retries)', async () => {
    mockConfirmOrder.mockRejectedValue(new Error('db down'));
    const res = makeRes();
    await storeWebhookHandler(makeReq(), res as unknown as Response);

    expect(res._status).toBe(500);
    expect(res._json).toEqual({ error: 'processing_failed' });
    expect(mockFailed).toHaveBeenCalledWith('rec_1', 'db down');
    expect(mockProcessed).not.toHaveBeenCalled();
  });

  it('returns 200 when confirmOrder succeeds', async () => {
    mockConfirmOrder.mockResolvedValue(undefined);
    const res = makeRes();
    await storeWebhookHandler(makeReq(), res as unknown as Response);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ received: true });
    expect(mockConfirmOrder).toHaveBeenCalledWith('order_1', 'pay_1');
    expect(mockProcessed).toHaveBeenCalledWith('rec_1');
  });
});
