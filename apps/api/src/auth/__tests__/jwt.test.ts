import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signAccess, verifyAccess } from '../jwt.js';

// env vars are pre-set by src/vitest.setup.ts

describe('signAccess()', () => {
  it('returns a non-empty JWT string', async () => {
    const token = await signAccess({
      userId: 'user-123',
      role: 'INDIVIDUAL',
      sessionId: 'sess-456',
    });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });
});

describe('verifyAccess()', () => {
  it('resolves with correct payload for a valid token', async () => {
    const token = await signAccess({
      userId: 'user-123',
      role: 'ADMIN',
      sessionId: 'sess-789',
    });

    const payload = await verifyAccess(token);
    expect(payload.sub).toBe('user-123');
    expect(payload.role).toBe('ADMIN');
    expect(payload.sessionId).toBe('sess-789');
    expect(payload.type).toBe('access');
  });

  it('rejects a tampered token', async () => {
    const token = await signAccess({
      userId: 'user-999',
      role: 'INDIVIDUAL',
      sessionId: 'sess-000',
    });

    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;

    await expect(verifyAccess(tamperedToken)).rejects.toMatchObject({
      name: 'TOKEN_INVALID',
    });
  });

  it('rejects a completely malformed token', async () => {
    await expect(verifyAccess('not.a.jwt')).rejects.toMatchObject({
      name: 'TOKEN_INVALID',
    });
  });

  it('rejects an expired token', async () => {
    // Travel back 20 minutes so the token is already past its 15m TTL
    const pastTime = Date.now() - 20 * 60 * 1000;
    vi.setSystemTime(pastTime);

    const token = await signAccess({
      userId: 'user-exp',
      role: 'INDIVIDUAL',
      sessionId: 'sess-exp',
    });

    // Restore to real time — token is now 20 min old, expired after 15 min
    vi.useRealTimers();

    await expect(verifyAccess(token)).rejects.toMatchObject({
      name: 'TOKEN_EXPIRED',
    });
  });
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});
