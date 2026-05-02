import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/db.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
  },
}));

import { db } from '../../lib/db.js';
import { recordKycAuditEvent } from '../audit.js';

beforeEach(() => vi.clearAllMocks());

describe('recordKycAuditEvent', () => {
  it('inserts an audit row with the given fields', async () => {
    await recordKycAuditEvent({
      profileId: 'p1', eventType: 'AADHAAR_VERIFIED', actorId: 'u1', actorRole: 'USER',
      fromStatus: 'PENDING', toStatus: 'MANUAL_REVIEW',
      ipAddress: '1.2.3.4', userAgent: 'Chrome',
      metadata: { refId: 'R1' },
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('swallows insert errors so callers never fail', async () => {
    const insertSpy = vi.mocked(db.insert);
    insertSpy.mockReturnValueOnce({
      values: vi.fn().mockRejectedValue(new Error('DB down')),
    } as unknown as ReturnType<typeof db.insert>);
    await expect(recordKycAuditEvent({ profileId: 'p1', eventType: 'INITIATED' })).resolves.toBeUndefined();
  });

  it('defaults actorRole to SYSTEM and nullable fields to null', async () => {
    let captured: Record<string, unknown> | undefined;
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn((v) => { captured = v as Record<string, unknown>; return Promise.resolve([]); }),
    } as unknown as ReturnType<typeof db.insert>);
    await recordKycAuditEvent({ profileId: 'p1', eventType: 'PHOTO_ANALYZED' });
    expect(captured?.actorRole).toBe('SYSTEM');
    expect(captured?.actorId).toBeNull();
    expect(captured?.metadata).toBeNull();
  });
});
