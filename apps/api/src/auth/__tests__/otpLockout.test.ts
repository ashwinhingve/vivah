import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted Redis mock — every method returns a fresh Promise so we can assert
// on call shape without standing up a real Redis instance.
const redisMock = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    get:    vi.fn(async (key: string) => store.get(key) ?? null),
    incr:   vi.fn(async (key: string) => {
      const n = (Number(store.get(key) ?? 0)) + 1;
      store.set(key, String(n));
      return n;
    }),
    expire: vi.fn(async (_key: string, _seconds: number) => 1),
    set:    vi.fn(async (key: string, value: string, _ex?: string, _ttl?: number) => {
      store.set(key, value);
      return 'OK';
    }),
    del:    vi.fn(async (...keys: string[]) => {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n++;
      return n;
    }),
    _reset: () => { store.clear(); },
  };
});

vi.mock('../../lib/redis.js', () => ({ redis: redisMock }));

import {
  isPhoneLocked,
  recordOtpFailure,
  recordOtpSuccess,
  recordOtpSent,
} from '../otpLockout.js';

const PHONE = '+919999988888';

describe('otpLockout', () => {
  beforeEach(() => {
    redisMock._reset();
    vi.clearAllMocks();
  });

  it('starts unlocked', async () => {
    expect(await isPhoneLocked(PHONE)).toBe(false);
  });

  it('counts failures, locks after 5', async () => {
    let last = { failures: 0, locked: false, remaining: 5 };
    for (let i = 1; i <= 4; i++) {
      last = await recordOtpFailure(PHONE);
      expect(last.locked).toBe(false);
      expect(last.failures).toBe(i);
      expect(last.remaining).toBe(5 - i);
    }
    expect(await isPhoneLocked(PHONE)).toBe(false);
    last = await recordOtpFailure(PHONE);
    expect(last.locked).toBe(true);
    expect(last.remaining).toBe(0);
    expect(await isPhoneLocked(PHONE)).toBe(true);
  });

  it('expires the failure counter on first increment', async () => {
    await recordOtpFailure(PHONE);
    expect(redisMock.expire).toHaveBeenCalledWith(`auth:otp:fail:${PHONE}`, 15 * 60);
  });

  it('does not re-expire on subsequent failures', async () => {
    await recordOtpFailure(PHONE);
    await recordOtpFailure(PHONE);
    // Single expire call (only on first incr returning 1).
    expect(redisMock.expire).toHaveBeenCalledTimes(1);
  });

  it('clears state on successful verify', async () => {
    await recordOtpFailure(PHONE);
    await recordOtpFailure(PHONE);
    await recordOtpSuccess(PHONE);
    expect(redisMock.del).toHaveBeenCalledWith(`auth:otp:fail:${PHONE}`, `auth:otp:lock:${PHONE}`);
  });

  it('falls through gracefully when Redis throws on isPhoneLocked', async () => {
    redisMock.get.mockRejectedValueOnce(new Error('redis down'));
    expect(await isPhoneLocked(PHONE)).toBe(false);
  });

  it('falls through gracefully when Redis throws on recordOtpFailure', async () => {
    redisMock.incr.mockRejectedValueOnce(new Error('redis down'));
    const result = await recordOtpFailure(PHONE);
    expect(result).toEqual({ failures: 0, locked: false, remaining: 5 });
  });

  it('records OTP sends with TTL', async () => {
    await recordOtpSent(PHONE);
    expect(redisMock.incr).toHaveBeenCalledWith(`auth:otp:send:${PHONE}`);
    expect(redisMock.expire).toHaveBeenCalledWith(`auth:otp:send:${PHONE}`, 15 * 60);
  });
});
