/**
 * A2-03 — Razorpay money-out idempotency.
 *
 * The Razorpay Node SDK (v2.9.6) strips non-allowlisted headers, so
 * X-Razorpay-Idempotency-Key is sent via the raw `razorpayPost` path. These tests
 * assert the header is sent when a key is supplied, omitted otherwise, and that a
 * non-2xx normalises to `{ statusCode }` so `withRetry` retries (reusing the same
 * key → Razorpay dedupes the retry instead of double-executing).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { razorpayPost } from '../razorpay.js';

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:     status >= 200 && status < 300,
    status,
    json:   async () => body,
  } as Response);
}

function headersOf(spy: ReturnType<typeof mockFetch>): Record<string, string> {
  const init = spy.mock.calls[0]![1] as RequestInit;
  return init.headers as Record<string, string>;
}

describe('razorpayPost idempotency (A2-03)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends X-Razorpay-Idempotency-Key when a key is provided', async () => {
    const spy = mockFetch(200, { id: 'rfnd_1', amount: 100, status: 'processed' });
    await razorpayPost('/payments/pay_1/refund', { amount: 100 }, 'refund:abc-123');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(headersOf(spy)['X-Razorpay-Idempotency-Key']).toBe('refund:abc-123');
  });

  it('omits the idempotency header when no key is provided', async () => {
    const spy = mockFetch(200, { id: 'order_1' });
    await razorpayPost('/orders', { amount: 100 });
    expect(headersOf(spy)['X-Razorpay-Idempotency-Key']).toBeUndefined();
  });

  it('normalises a non-2xx response to { statusCode } so withRetry can retry', async () => {
    mockFetch(500, { error: { description: 'server error' } });
    await expect(
      razorpayPost('/transfers', { amount: 100 }, 'transfer:xyz'),
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});
