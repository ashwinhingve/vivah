import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../../lib/db.js', () => ({ db: {} }));

vi.mock('@smartshaadi/db', () => ({
  shortlists:    {},
  profiles:      {},
  profilePhotos: {},
}));

vi.mock('drizzle-orm', () => ({
  eq:   vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and:  vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: vi.fn((_col: unknown) => ({ type: 'desc', _col })),
  sql:  vi.fn(() => ({ type: 'sql' })),
}));

vi.mock('../../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true },
}));

vi.mock('../../../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: {
    findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

// A select chain where .limit() resolves (for single-row lookups)
function makeSelectChainLimitResolves(resolveWith: AnyRecord[]) {
  return {
    from:    vi.fn().mockReturnThis(),
    where:   vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit:   vi.fn().mockResolvedValue(resolveWith),
    offset:  vi.fn().mockResolvedValue(resolveWith),
  };
}

function makeInsertChain(resolveWith: AnyRecord[]) {
  return {
    values:            vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning:         vi.fn().mockResolvedValue(resolveWith),
  };
}

function makeDeleteChain(resolveWith: AnyRecord[]) {
  return {
    where:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(resolveWith),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('matchmaking/shortlists/service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Export surface ──────────────────────────────────────────────────────────

  it('exports addShortlist', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.addShortlist).toBe('function');
  });

  it('exports removeShortlist', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.removeShortlist).toBe('function');
  });

  it('exports listShortlists', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.listShortlists).toBe('function');
  });

  it('exports isShortlisted', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.isShortlisted).toBe('function');
  });

  // ── addShortlist ────────────────────────────────────────────────────────────

  describe('addShortlist', () => {
    it('throws SELF_SHORTLIST when profileId === targetProfileId', async () => {
      const { addShortlist } = await import('../service.js');
      await expect(addShortlist('profile-1', 'profile-1')).rejects.toMatchObject({
        code: 'SELF_SHORTLIST',
      });
    });

    it('inserts a new row and returns enriched item on success', async () => {
      const dbMod = await import('../../../lib/db.js');
      const inserted = {
        id: 'sl-1', profileId: 'profile-1', targetProfileId: 'profile-2',
        note: 'interesting', createdAt: new Date(),
      };

      // insert → returning gives a row
      (dbMod.db as unknown as AnyRecord)['insert'] = vi.fn().mockReturnValue(
        makeInsertChain([inserted]),
      );
      // select calls for enrichOne: verificationStatus + primaryPhoto + isShortlisted check
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChainLimitResolves([{ verificationStatus: 'VERIFIED', r2Key: 'photos/abc.jpg' }]),
      );

      const { addShortlist } = await import('../service.js');
      const result = await addShortlist('profile-1', 'profile-2', 'interesting');

      expect(result.id).toBe('sl-1');
      expect(result.profileId).toBe('profile-1');
      expect(result.targetProfileId).toBe('profile-2');
      expect(result.note).toBe('interesting');
    });

    it('fetches existing row when onConflictDoNothing fires (duplicate)', async () => {
      const dbMod = await import('../../../lib/db.js');
      const existingRow = {
        id: 'sl-existing', profileId: 'profile-1', targetProfileId: 'profile-2',
        note: null, createdAt: new Date(),
      };

      let insertCalled = false;
      let selectCallCount = 0;

      (dbMod.db as unknown as AnyRecord)['insert'] = vi.fn().mockReturnValue({
        values:              vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        // returning → empty array simulates conflict
        returning:           vi.fn().mockImplementation(() => {
          insertCalled = true;
          return Promise.resolve([]);
        }),
      });

      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockImplementation(() => {
        selectCallCount += 1;
        if (selectCallCount === 1) {
          // fetchExisting after conflict
          return makeSelectChainLimitResolves([existingRow]);
        }
        // enrichOne selects (verificationStatus, photo)
        return makeSelectChainLimitResolves([{ verificationStatus: 'PENDING' }]);
      });

      const { addShortlist } = await import('../service.js');
      const result = await addShortlist('profile-1', 'profile-2');

      expect(insertCalled).toBe(true);
      expect(result.id).toBe('sl-existing');
    });
  });

  // ── removeShortlist ─────────────────────────────────────────────────────────

  describe('removeShortlist', () => {
    it('returns true when a row was deleted', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['delete'] = vi.fn().mockReturnValue(
        makeDeleteChain([{ id: 'sl-1' }]),
      );

      const { removeShortlist } = await import('../service.js');
      const result = await removeShortlist('profile-1', 'profile-2');
      expect(result).toBe(true);
    });

    it('returns false when no row matched', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['delete'] = vi.fn().mockReturnValue(
        makeDeleteChain([]),
      );

      const { removeShortlist } = await import('../service.js');
      const result = await removeShortlist('profile-1', 'profile-999');
      expect(result).toBe(false);
    });
  });

  // ── isShortlisted ───────────────────────────────────────────────────────────

  describe('isShortlisted', () => {
    it('returns true when a matching row exists', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChainLimitResolves([{ id: 'sl-1' }]),
      );

      const { isShortlisted } = await import('../service.js');
      expect(await isShortlisted('profile-1', 'profile-2')).toBe(true);
    });

    it('returns false when no matching row exists', async () => {
      const dbMod = await import('../../../lib/db.js');
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue(
        makeSelectChainLimitResolves([]),
      );

      const { isShortlisted } = await import('../service.js');
      expect(await isShortlisted('profile-1', 'profile-2')).toBe(false);
    });
  });

  // ── listShortlists ──────────────────────────────────────────────────────────

  describe('listShortlists', () => {
    it('returns paginated items ordered by createdAt desc', async () => {
      const dbMod = await import('../../../lib/db.js');
      const rows = [
        { id: 'sl-2', profileId: 'p-1', targetProfileId: 'p-3', note: null, createdAt: new Date() },
        { id: 'sl-1', profileId: 'p-1', targetProfileId: 'p-2', note: null, createdAt: new Date(Date.now() - 1000) },
      ];

      let selectCallCount = 0;
      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockImplementation(() => {
        selectCallCount += 1;
        if (selectCallCount === 1) {
          // main list query
          return {
            from:    vi.fn().mockReturnThis(),
            where:   vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit:   vi.fn().mockReturnThis(),
            offset:  vi.fn().mockResolvedValue(rows),
          };
        }
        if (selectCallCount === 2) {
          // count query
          return {
            from:  vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ count: '2' }]),
          };
        }
        // enrichOne calls (verificationStatus + photo for each row)
        return makeSelectChainLimitResolves([{ verificationStatus: 'PENDING' }]);
      });

      const { listShortlists } = await import('../service.js');
      const result = await listShortlists('p-1', 1, 20);

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items).toHaveLength(2);
    });

    it('applies correct pagination offset (page 2, limit 10 → offset 10)', async () => {
      const dbMod = await import('../../../lib/db.js');
      const offsetMock = vi.fn().mockResolvedValue([]);
      let selectCallCount = 0;

      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockImplementation(() => {
        selectCallCount += 1;
        if (selectCallCount === 1) {
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

      const { listShortlists } = await import('../service.js');
      await listShortlists('p-1', 2, 10);

      expect(offsetMock).toHaveBeenCalledWith(10);
    });

    it('returns empty items array when no shortlists exist', async () => {
      const dbMod = await import('../../../lib/db.js');
      let selectCallCount = 0;

      (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockImplementation(() => {
        selectCallCount += 1;
        if (selectCallCount === 1) {
          return {
            from:    vi.fn().mockReturnThis(),
            where:   vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit:   vi.fn().mockReturnThis(),
            offset:  vi.fn().mockResolvedValue([]),
          };
        }
        return {
          from:  vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: '0' }]),
        };
      });

      const { listShortlists } = await import('../service.js');
      const result = await listShortlists('p-1', 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
