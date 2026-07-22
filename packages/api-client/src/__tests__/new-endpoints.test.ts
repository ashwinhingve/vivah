import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../client.js';
import { BookingEndpoints } from '../endpoints/bookings.js';
import { PaymentEndpoints } from '../endpoints/payments.js';
import { VendorEndpoints } from '../endpoints/vendors.js';
import { MatchmakingEndpoints } from '../endpoints/matchmaking.js';

/**
 * Contract tests for the Sprint-II mobile surface: bookings, Razorpay
 * subscribe/cancel, vendor availability, and blocked-user list/unblock. These
 * assert the HTTP shape (method, path, query, body) each method produces — the
 * one thing a typo silently breaks and the type system cannot catch, since every
 * path is a string.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ok<T>(data: T): unknown {
  return { success: true, data, error: null, meta: { timestamp: 'x' } };
}

function harness() {
  const fetchImpl = vi.fn(async () => jsonResponse(ok({}))) as unknown as typeof fetch;
  const client = new ApiClient({
    baseUrl: 'https://api.example.test',
    getCookieHeader: () => 'better-auth.session_token=t',
    fetchImpl,
  });
  const call = () => vi.mocked(fetchImpl).mock.calls[0];
  return { fetchImpl, client, call };
}

describe('BookingEndpoints', () => {
  it('create POSTs to /bookings with the payload body', async () => {
    const { client, call } = harness();
    await new BookingEndpoints(client).create({
      vendorId: 'v1',
      eventDate: '2026-08-01',
      totalAmount: 50000,
    });
    const [url, init] = call()!;
    expect(url).toBe('https://api.example.test/api/v1/bookings');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      vendorId: 'v1',
      eventDate: '2026-08-01',
      totalAmount: 50000,
    });
  });

  it('list GETs /bookings and drops undefined query params', async () => {
    const { client, call } = harness();
    await new BookingEndpoints(client).list({ role: 'customer', page: 2 });
    const [url, init] = call()!;
    expect(init?.method).toBe('GET');
    expect(url).toBe('https://api.example.test/api/v1/bookings?role=customer&page=2');
  });

  it('cancel PUTs to /:id/cancel with the reason', async () => {
    const { client, call } = harness();
    await new BookingEndpoints(client).cancel('b1', 'changed plans');
    const [url, init] = call()!;
    expect(url).toBe('https://api.example.test/api/v1/bookings/b1/cancel');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ reason: 'changed plans' });
  });

  it('cancel sends an empty body when no reason is given', async () => {
    const { client, call } = harness();
    await new BookingEndpoints(client).cancel('b1');
    const [, init] = call()!;
    expect(init?.body).toBe('{}');
  });
});

describe('PaymentEndpoints subscription mutations', () => {
  it('startSubscription POSTs the plan code', async () => {
    const { client, call } = harness();
    await new PaymentEndpoints(client).startSubscription('PREMIUM_M');
    const [url, init] = call()!;
    expect(url).toBe('https://api.example.test/api/v1/payments/subscriptions');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ planCode: 'PREMIUM_M' });
  });

  it('cancelSubscription DELETEs with the atCycleEnd body (default true)', async () => {
    const { client, call } = harness();
    await new PaymentEndpoints(client).cancelSubscription('sub1');
    const [url, init] = call()!;
    expect(url).toBe('https://api.example.test/api/v1/payments/subscriptions/sub1');
    expect(init?.method).toBe('DELETE');
    // The bodyless delete() helper cannot carry {atCycleEnd}; this must go
    // through request() so the flag actually reaches the server.
    expect(JSON.parse(init?.body as string)).toEqual({ atCycleEnd: true });
  });

  it('cancelSubscription forwards atCycleEnd=false for immediate cancel', async () => {
    const { client, call } = harness();
    await new PaymentEndpoints(client).cancelSubscription('sub1', false);
    const [, init] = call()!;
    expect(JSON.parse(init?.body as string)).toEqual({ atCycleEnd: false });
  });
});

describe('VendorEndpoints.getAvailability', () => {
  it('GETs the availability path with the month query', async () => {
    const { client, call } = harness();
    await new VendorEndpoints(client).getAvailability('v1', '2026-08');
    const [url, init] = call()!;
    expect(init?.method).toBe('GET');
    expect(url).toBe(
      'https://api.example.test/api/v1/vendors/v1/availability?month=2026-08',
    );
  });
});

describe('MatchmakingEndpoints blocked users', () => {
  it('getBlockedUsers GETs /matchmaking/blocks', async () => {
    const { client, call } = harness();
    await new MatchmakingEndpoints(client).getBlockedUsers();
    const [url, init] = call()!;
    expect(init?.method).toBe('GET');
    expect(url).toBe('https://api.example.test/api/v1/matchmaking/blocks');
  });

  it('unblockProfile DELETEs /matchmaking/block/:id', async () => {
    const { client, call } = harness();
    await new MatchmakingEndpoints(client).unblockProfile('p9');
    const [url, init] = call()!;
    expect(init?.method).toBe('DELETE');
    expect(url).toBe('https://api.example.test/api/v1/matchmaking/block/p9');
  });
});
