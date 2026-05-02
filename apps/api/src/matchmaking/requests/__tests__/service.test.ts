import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../../lib/db.js', () => ({ db: {} }));

vi.mock('@smartshaadi/db', () => ({
  matchRequests:        {},
  blockedUsers:         {},
  matchRequestReports:  {},
  profiles:             {},
  profilePhotos:        {},
  auditLogs:            {},
}));

vi.mock('drizzle-orm', () => ({
  eq:      vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and:     vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  or:      vi.fn((...args: unknown[]) => ({ type: 'or', args })),
  sql:     vi.fn(() => ({ type: 'sql' })),
  desc:    vi.fn((_col: unknown) => ({ type: 'desc', _col })),
  inArray: vi.fn((_col: unknown, _vals: unknown[]) => ({ type: 'inArray', _col, _vals })),
  gt:      vi.fn((_col: unknown, _val: unknown) => ({ type: 'gt', _col, _val })),
  lt:      vi.fn((_col: unknown, _val: unknown) => ({ type: 'lt', _col, _val })),
}));

// notifications queue is now imported from the shared module — mock it directly
const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
vi.mock('../../../infrastructure/redis/queues.js', () => ({
  matchComputeQueue:   { add: vi.fn() },
  notificationsQueue:  { add: mockQueueAdd },
  escrowReleaseQueue:  { add: vi.fn() },
  orderExpiryQueue:    { add: vi.fn() },
  queueNotification:   vi.fn(),
  DEFAULT_JOB_OPTS:    {},
  connection:          {},
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
}));

vi.mock('../../../lib/env.js', () => ({
  env: { REDIS_URL: 'redis://localhost:6379', USE_MOCK_SERVICES: true },
}));

vi.mock('../../../infrastructure/mongo/models/Chat.js', () => ({
  Chat: { create: vi.fn().mockResolvedValue({ _id: 'mongo-chat-id' }) },
}));

const mockUpsertFieldFn = vi.fn((userId: string, field: string, value: unknown) => {
  return { userId, [field]: value };
});
vi.mock('../../../lib/mockStore.js', () => ({
  mockUpsertField: mockUpsertFieldFn,
  mockGet:         vi.fn(() => null),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

function makeSelectChain(resolveWith: AnyRecord[]) {
  return {
    from:    vi.fn().mockReturnThis(),
    where:   vi.fn().mockResolvedValue(resolveWith),
    orderBy: vi.fn().mockReturnThis(),
    limit:   vi.fn().mockReturnThis(),
    offset:  vi.fn().mockResolvedValue(resolveWith),
  };
}

function makeInsertChain(resolveWith: AnyRecord[]) {
  return {
    values:             vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning:          vi.fn().mockResolvedValue(resolveWith),
  };
}

function makeUpdateChain(resolveWith: AnyRecord[]) {
  return {
    set:       vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(resolveWith),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('matchmaking/requests/service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Export surface ──────────────────────────────────────────────────────────

  it('exports sendRequest', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.sendRequest).toBe('function');
  });

  it('exports acceptRequest', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.acceptRequest).toBe('function');
  });

  it('exports declineRequest', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.declineRequest).toBe('function');
  });

  it('exports withdrawRequest', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.withdrawRequest).toBe('function');
  });

  it('exports blockUser', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.blockUser).toBe('function');
  });

  it('exports reportUser', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.reportUser).toBe('function');
  });

  it('exports getReceivedRequests', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.getReceivedRequests).toBe('function');
  });

  it('exports getSentRequests', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.getSentRequests).toBe('function');
  });

  it('exports markRequestSeen', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.markRequestSeen).toBe('function');
  });

  it('exports unblockUser', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.unblockUser).toBe('function');
  });

  it('exports listBlockedUsers', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.listBlockedUsers).toBe('function');
  });

  it('exports expireOldRequests', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.expireOldRequests).toBe('function');
  });

  it('exports getEnrichedRequests', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.getEnrichedRequests).toBe('function');
  });

  // ── sendRequest ─────────────────────────────────────────────────────────────

  describe('sendRequest', () => {
    it('throws SELF_REQUEST when sender === receiver', async () => {
      const { sendRequest } = await import('../service.js');
      await expect(sendRequest('user-1', 'user-1')).rejects.toMatchObject({
        code: 'SELF_REQUEST',
      });
    });

    it('throws BLOCKED if a block relationship exists', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'block-1' }]),
      );

      const { sendRequest } = await import('../service.js');
      await expect(sendRequest('user-1', 'user-2')).rejects.toMatchObject({
        code: 'BLOCKED',
      });
    });

    it('throws DUPLICATE_REQUEST if a PENDING request already exists from sender', async () => {
      const dbMod = await import('../../../lib/db.js');
      let call = 0;
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockImplementation(() => ({
        from:  vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          call += 1;
          // 1st = block check (empty), 2nd = open (hit, sender→receiver pending)
          return Promise.resolve(call === 1 ? [] : [{ id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING' }]);
        }),
      }));

      const { sendRequest } = await import('../service.js');
      await expect(sendRequest('user-1', 'user-2')).rejects.toMatchObject({
        code: 'DUPLICATE_REQUEST',
      });
    });

    it('inserts PENDING record with expiresAt and pushes notification job', async () => {
      const dbMod = await import('../../../lib/db.js');
      const created = {
        id: 'req-new', senderId: 'user-1', receiverId: 'user-2',
        status: 'PENDING', priority: 'NORMAL', message: 'Hi',
        acceptanceMessage: null, declineReason: null, seenAt: null,
        createdAt: new Date(), updatedAt: new Date(),
        respondedAt: null, expiresAt: new Date(Date.now() + 14 * 86_400_000),
      };

      // select() chains: must be both awaitable AND chainable to .limit()
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockImplementation(() => {
        const chain: AnyRecord = {
          from:  vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };
        chain['then'] = (resolve: (v: unknown[]) => unknown) => Promise.resolve(resolve([]));
        return chain;
      });

      (dbMod.db as unknown as AnyRecord)['insert'] = vi.fn().mockReturnValue(
        makeInsertChain([created]),
      );

      const { sendRequest } = await import('../service.js');
      const result = await sendRequest('user-1', 'user-2', { message: 'Hi' });

      expect(result.status).toBe('PENDING');
      expect(result.senderId).toBe('user-1');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'MATCH_REQUEST_RECEIVED',
        expect.objectContaining({ type: 'MATCH_REQUEST_RECEIVED', userId: 'user-2' }),
        expect.any(Object),
      );
    });
  });

  // ── acceptRequest ────────────────────────────────────────────────────────────

  describe('acceptRequest', () => {
    it('throws NOT_FOUND when request does not exist', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([]),
      );

      const { acceptRequest } = await import('../service.js');
      await expect(acceptRequest('user-2', 'req-99')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws FORBIDDEN when userId is not the receiver', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING' }]),
      );

      const { acceptRequest } = await import('../service.js');
      await expect(acceptRequest('user-WRONG', 'req-1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('throws INVALID_STATUS when request is not PENDING', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'ACCEPTED' }]),
      );

      const { acceptRequest } = await import('../service.js');
      await expect(acceptRequest('user-2', 'req-1')).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('updates status to ACCEPTED, uses mock store for Chat, pushes notification', async () => {
      const dbMod = await import('../../../lib/db.js');
      const accepted = {
        id: 'req-1', senderId: 'user-1', receiverId: 'user-2',
        status: 'ACCEPTED', createdAt: new Date(), updatedAt: new Date(),
        message: null, respondedAt: new Date(), expiresAt: null,
      };

      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING' }]),
      );
      (dbMod.db as unknown as AnyRecord)['update'] = vi.fn().mockReturnValue(
        makeUpdateChain([accepted]),
      );

      const { acceptRequest } = await import('../service.js');
      const result = await acceptRequest('user-2', 'req-1');

      expect(result.status).toBe('ACCEPTED');
      // In mock mode, mockUpsertField is called instead of Chat.create
      expect(mockUpsertFieldFn).toHaveBeenCalledWith(
        'req-1',
        'chat',
        expect.objectContaining({ participants: ['user-1', 'user-2'], isActive: true }),
      );
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'MATCH_ACCEPTED',
        expect.objectContaining({ type: 'MATCH_ACCEPTED', userId: 'user-1' }),
        expect.any(Object),
      );
    });
  });

  // ── declineRequest ───────────────────────────────────────────────────────────

  describe('declineRequest', () => {
    it('throws FORBIDDEN when userId is not the receiver', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING' }]),
      );

      const { declineRequest } = await import('../service.js');
      await expect(declineRequest('user-WRONG', 'req-1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('updates status to DECLINED for the receiver', async () => {
      const dbMod = await import('../../../lib/db.js');
      const declined = {
        id: 'req-1', senderId: 'user-1', receiverId: 'user-2',
        status: 'DECLINED', createdAt: new Date(), updatedAt: new Date(),
        message: null, respondedAt: new Date(), expiresAt: null,
      };

      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING' }]),
      );
      (dbMod.db as unknown as AnyRecord)['update'] = vi.fn().mockReturnValue(
        makeUpdateChain([declined]),
      );

      const { declineRequest } = await import('../service.js');
      const result = await declineRequest('user-2', 'req-1');

      expect(result.status).toBe('DECLINED');
    });
  });

  // ── withdrawRequest ──────────────────────────────────────────────────────────

  describe('withdrawRequest', () => {
    it('throws FORBIDDEN when userId is not the sender', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING' }]),
      );

      const { withdrawRequest } = await import('../service.js');
      await expect(withdrawRequest('user-WRONG', 'req-1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('updates status to WITHDRAWN for the sender', async () => {
      const dbMod = await import('../../../lib/db.js');
      const withdrawn = {
        id: 'req-1', senderId: 'user-1', receiverId: 'user-2',
        status: 'WITHDRAWN', createdAt: new Date(), updatedAt: new Date(),
        message: null, respondedAt: null, expiresAt: null,
      };

      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING' }]),
      );
      (dbMod.db as unknown as AnyRecord)['update'] = vi.fn().mockReturnValue(
        makeUpdateChain([withdrawn]),
      );

      const { withdrawRequest } = await import('../service.js');
      const result = await withdrawRequest('user-1', 'req-1');

      expect(result.status).toBe('WITHDRAWN');
    });
  });

  // ── blockUser ────────────────────────────────────────────────────────────────

  describe('blockUser', () => {
    it('inserts a blocked_users record and updates pending requests to BLOCKED', async () => {
      const dbMod = await import('../../../lib/db.js');
      const insertMock = vi.fn().mockReturnValue(makeInsertChain([{ id: 'block-new' }]));
      const updateMock = vi.fn().mockReturnValue({
        set:       vi.fn().mockReturnThis(),
        where:     vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      });

      (dbMod.db as unknown as AnyRecord)['insert'] = insertMock;
      (dbMod.db as unknown as AnyRecord)['update'] = updateMock;

      const { blockUser } = await import('../service.js');
      await blockUser('user-1', 'profile-2');

      expect(insertMock).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalled();
    });
  });

  // ── getReceivedRequests ──────────────────────────────────────────────────────

  describe('getReceivedRequests', () => {
    it('returns paginated requests for the receiver', async () => {
      const dbMod = await import('../../../lib/db.js');
      const rows = [
        { id: 'req-1', receiverId: 'user-2', status: 'PENDING', createdAt: new Date() },
        { id: 'req-2', receiverId: 'user-2', status: 'PENDING', createdAt: new Date() },
      ];

      let selectCall = 0;
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockImplementation(() => {
        selectCall += 1;
        if (selectCall === 1) {
          // data query
          return {
            from:    vi.fn().mockReturnThis(),
            where:   vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit:   vi.fn().mockReturnThis(),
            offset:  vi.fn().mockResolvedValue(rows),
          };
        }
        // count query
        return {
          from:  vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: '2' }]),
        };
      });

      const { getReceivedRequests } = await import('../service.js');
      const result = await getReceivedRequests('user-2', 1, 10);

      expect(Array.isArray(result.requests)).toBe(true);
      expect(result.requests).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('applies correct pagination offset (page 2, limit 10 → offset 10)', async () => {
      const dbMod = await import('../../../lib/db.js');
      const offsetMock = vi.fn().mockResolvedValue([]);
      let selectCall = 0;

      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockImplementation(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return {
            from:    vi.fn().mockReturnThis(),
            where:   vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit:   vi.fn().mockReturnThis(),
            offset:  offsetMock,
          };
        }
        return {
          from:  vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: '0' }]),
        };
      });

      const { getReceivedRequests } = await import('../service.js');
      await getReceivedRequests('user-2', 2, 10);

      expect(offsetMock).toHaveBeenCalledWith(10); // (page-1)*limit = 1*10 = 10
    });
  });

  // ── markRequestSeen ──────────────────────────────────────────────────────────

  describe('markRequestSeen', () => {
    it('throws FORBIDDEN when caller is not the receiver', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING', seenAt: null }]),
      );

      const { markRequestSeen } = await import('../service.js');
      await expect(markRequestSeen('user-WRONG', 'req-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('is a no-op when seenAt already set', async () => {
      const dbMod = await import('../../../lib/db.js');
      const already = { id: 'req-1', senderId: 'user-1', receiverId: 'user-2', status: 'PENDING', seenAt: new Date() };
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChain([already]),
      );
      const updateMock = vi.fn();
      (dbMod.db as unknown as AnyRecord)['update'] = updateMock;

      const { markRequestSeen } = await import('../service.js');
      const out = await markRequestSeen('user-2', 'req-1');
      expect(out.id).toBe('req-1');
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  // ── unblockUser ──────────────────────────────────────────────────────────────

  describe('unblockUser', () => {
    it('deletes the blocked_users record', async () => {
      const dbMod = await import('../../../lib/db.js');
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      (dbMod.db as unknown as AnyRecord)['delete'] = vi.fn().mockReturnValue({
        where: deleteWhere,
      });

      const { unblockUser } = await import('../service.js');
      await unblockUser('user-1', 'profile-2');
      expect(deleteWhere).toHaveBeenCalled();
    });
  });

  // ── reportUser (categorised) ─────────────────────────────────────────────────

  describe('reportUser', () => {
    it('throws SELF_REPORT when reporter === reported', async () => {
      const { reportUser } = await import('../service.js');
      await expect(
        reportUser('user-1', 'user-1', { category: 'HARASSMENT' }),
      ).rejects.toMatchObject({ code: 'SELF_REPORT' });
    });

    it('inserts a structured report and queues moderation notification', async () => {
      const dbMod = await import('../../../lib/db.js');
      // First select = recent dedupe (empty)
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue({
        from:  vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });
      (dbMod.db as unknown as AnyRecord)['insert'] = vi.fn().mockReturnValue(
        makeInsertChain([{ id: 'report-1' }]),
      );

      const { reportUser } = await import('../service.js');
      const result = await reportUser('user-1', 'profile-2', {
        category: 'HARASSMENT',
        details: 'Bad message',
      });
      expect(result.reportId).toBe('report-1');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'PROFILE_REPORTED_MODERATION',
        expect.objectContaining({
          type: 'PROFILE_REPORTED_MODERATION',
          payload: expect.objectContaining({ category: 'HARASSMENT' }),
        }),
        expect.any(Object),
      );
    });
  });

  // ── expireOldRequests ────────────────────────────────────────────────────────

  describe('expireOldRequests', () => {
    it('returns count of expired and notifies sender for each', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['update'] = vi.fn().mockReturnValue(
        makeUpdateChain([
          { id: 'req-1', senderId: 'user-A' },
          { id: 'req-2', senderId: 'user-B' },
        ]),
      );

      const { expireOldRequests } = await import('../service.js');
      const out = await expireOldRequests();
      expect(out.expired).toBe(2);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'MATCH_REQUEST_EXPIRED',
        expect.objectContaining({ userId: 'user-A' }),
        expect.any(Object),
      );
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'MATCH_REQUEST_EXPIRED',
        expect.objectContaining({ userId: 'user-B' }),
        expect.any(Object),
      );
    });
  });
});
