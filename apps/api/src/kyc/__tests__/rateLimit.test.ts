import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real Redis path: shouldUseMockKyc must be false so the limiter actually runs.
vi.mock('../../lib/env.js', () => ({ shouldUseMockKyc: false }));

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    ttl:    vi.fn(),
    incr:   vi.fn(),
    expire: vi.fn(),
    set:    vi.fn(),
    scan:   vi.fn(),
    del:    vi.fn(),
    keys:   vi.fn(),
  },
}));
vi.mock('../../lib/redis.js', () => ({ redis: redisMock }));

import { checkKycRateLimit, clearKycRateLimit } from '../rateLimit.js';

describe('checkKycRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.ttl.mockResolvedValue(-2);     // no lock
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
  });

  it('allows attempts at and below the limit (5th still allowed)', async () => {
    redisMock.incr.mockResolvedValue(5);     // 5th attempt — at limit
    const r = await checkKycRateLimit('profile-1', 'aadhaar');
    expect(r.allowed).toBe(true);
    expect(r.locked).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('blocks and locks on the attempt past the limit (6th)', async () => {
    redisMock.incr.mockResolvedValue(6);     // over limit
    const r = await checkKycRateLimit('profile-1', 'aadhaar');
    expect(r.allowed).toBe(false);
    expect(r.locked).toBe(true);
    // a 24h lock key is set
    expect(redisMock.set).toHaveBeenCalledWith('kyc:lock:profile-1', '1', 'EX', 24 * 60 * 60);
  });

  it('returns locked while a lock TTL is active (no counter increment)', async () => {
    redisMock.ttl.mockResolvedValue(3600);   // locked for 1h
    const r = await checkKycRateLimit('profile-1', 'aadhaar');
    expect(r.locked).toBe(true);
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBe(3600);
    expect(redisMock.incr).not.toHaveBeenCalled();
  });

  it('fails open on a redis error', async () => {
    redisMock.ttl.mockRejectedValue(new Error('redis down'));
    const r = await checkKycRateLimit('profile-1', 'aadhaar');
    expect(r.allowed).toBe(true);
  });
});

describe('clearKycRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.del.mockResolvedValue(1);
  });

  it('uses SCAN (never KEYS) and deletes matched counters + the lock', async () => {
    redisMock.scan
      .mockResolvedValueOnce(['10', ['kyc:rate:aadhaar:profile-1']])
      .mockResolvedValueOnce(['0',  ['kyc:rate:pan:profile-1']]);

    await clearKycRateLimit('profile-1');

    expect(redisMock.keys).not.toHaveBeenCalled();
    expect(redisMock.scan).toHaveBeenCalledTimes(2); // walked until cursor '0'
    expect(redisMock.del).toHaveBeenCalledWith('kyc:rate:aadhaar:profile-1', 'kyc:rate:pan:profile-1');
    expect(redisMock.del).toHaveBeenCalledWith('kyc:lock:profile-1');
  });
});
