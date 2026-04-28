import { describe, it, expect, beforeEach, vi } from 'vitest';

// Capture rows passed into db.insert(...).values(row).
const insertedRows: unknown[] = [];

const dbMock = vi.hoisted(() => {
  const _rows: unknown[] = [];
  return {
    _rows,
    insert: vi.fn().mockReturnValue({
      values: vi.fn(async (row: unknown) => { _rows.push(row); }),
    }),
    select: vi.fn(),
  };
});

vi.mock('../../lib/db.js', () => ({ db: dbMock }));
vi.mock('@smartshaadi/db', () => ({
  authEvents: { id: 'id', userId: 'userId', type: 'type' },
}));

import { recordAuthEvent, AuthEventType } from '../events.js';

describe('recordAuthEvent', () => {
  beforeEach(() => {
    dbMock._rows.length = 0;
    insertedRows.length = 0;
    vi.clearAllMocks();
  });

  it('writes a row asynchronously', async () => {
    recordAuthEvent({
      userId: 'user-123',
      type: AuthEventType.LOGIN_SUCCESS,
      ipAddress: '203.0.113.5',
      userAgent: 'Mozilla/5.0',
      metadata: { sessionId: 'sess-1' },
    });
    // fire-and-forget — wait one microtask + macrotask
    await new Promise((r) => setTimeout(r, 5));
    expect(dbMock.insert).toHaveBeenCalledOnce();
    expect(dbMock._rows).toHaveLength(1);
    const row = dbMock._rows[0] as Record<string, unknown>;
    expect(row['userId']).toBe('user-123');
    expect(row['type']).toBe('LOGIN_SUCCESS');
    expect(row['ipAddress']).toBe('203.0.113.5');
    expect(row['userAgent']).toBe('Mozilla/5.0');
    expect(row['metadata']).toEqual({ sessionId: 'sess-1' });
    expect(typeof row['id']).toBe('string');
  });

  it('coerces missing fields to null', async () => {
    recordAuthEvent({ userId: null, type: AuthEventType.OTP_SENT });
    await new Promise((r) => setTimeout(r, 5));
    const row = dbMock._rows[0] as Record<string, unknown>;
    expect(row['userId']).toBeNull();
    expect(row['ipAddress']).toBeNull();
    expect(row['userAgent']).toBeNull();
    expect(row['metadata']).toBeNull();
  });

  it('swallows DB errors without throwing', async () => {
    dbMock.insert.mockReturnValueOnce({
      values: vi.fn().mockRejectedValue(new Error('boom')),
    });
    expect(() => recordAuthEvent({ userId: 'u', type: AuthEventType.LOGIN_FAILED })).not.toThrow();
    await new Promise((r) => setTimeout(r, 5));
  });
});
