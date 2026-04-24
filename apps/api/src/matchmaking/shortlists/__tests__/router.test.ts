import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockAddShortlist    = vi.fn();
const mockRemoveShortlist = vi.fn();
const mockListShortlists  = vi.fn();
const mockIsShortlisted   = vi.fn();

vi.mock('../service.js', () => ({
  addShortlist:    mockAddShortlist,
  removeShortlist: mockRemoveShortlist,
  listShortlists:  mockListShortlists,
  isShortlisted:   mockIsShortlisted,
}));

// authenticate middleware — inject a fake user into req.user
vi.mock('../../../auth/middleware.js', () => ({
  authenticate: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'user-auth-1', role: 'INDIVIDUAL', status: 'ACTIVE', name: 'Test User' };
    next();
  }),
}));

// db.select for resolveProfileId
const mockDbSelect = vi.fn();
vi.mock('../../../lib/db.js', () => ({ db: { select: mockDbSelect } }));

vi.mock('@smartshaadi/db', () => ({ profiles: {} }));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({ type: 'eq' })),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

async function buildApp() {
  const { shortlistsRouter } = await import('../router.js');
  const app = express();
  app.use(express.json());
  app.use('/shortlists', shortlistsRouter);
  return app;
}

function makeProfileResolverChain(profileId: string | null) {
  return {
    from:  vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(profileId ? [{ id: profileId }] : []),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('shortlists router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /shortlists/mine ─────────────────────────────────────────────────────

  describe('GET /shortlists/mine', () => {
    it('returns 200 with paginated shortlists', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain('profile-1'));
      mockListShortlists.mockResolvedValue({
        items: [], total: 0, page: 1, limit: 20,
      });

      const app = await buildApp();
      const res = await request(app).get('/shortlists/mine');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ total: 0, page: 1, limit: 20 });
    });

    it('returns 404 when profile not found', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain(null));

      const app = await buildApp();
      const res = await request(app).get('/shortlists/mine');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROFILE_NOT_FOUND');
    });

    it('passes page and limit query params to service', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain('profile-1'));
      mockListShortlists.mockResolvedValue({
        items: [], total: 0, page: 3, limit: 5,
      });

      const app = await buildApp();
      await request(app).get('/shortlists/mine?page=3&limit=5');

      expect(mockListShortlists).toHaveBeenCalledWith('profile-1', 3, 5);
    });
  });

  // ── GET /shortlists/is-shortlisted/:targetProfileId ──────────────────────────

  describe('GET /shortlists/is-shortlisted/:targetProfileId', () => {
    it('returns 200 with shortlisted: true', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain('profile-1'));
      mockIsShortlisted.mockResolvedValue(true);

      const app = await buildApp();
      const res = await request(app).get('/shortlists/is-shortlisted/profile-2');

      expect(res.status).toBe(200);
      expect(res.body.data.shortlisted).toBe(true);
    });

    it('returns 200 with shortlisted: false when not bookmarked', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain('profile-1'));
      mockIsShortlisted.mockResolvedValue(false);

      const app = await buildApp();
      const res = await request(app).get('/shortlists/is-shortlisted/profile-999');

      expect(res.status).toBe(200);
      expect(res.body.data.shortlisted).toBe(false);
    });
  });

  // ── POST /shortlists/:targetProfileId ─────────────────────────────────────────

  describe('POST /shortlists/:targetProfileId', () => {
    it('returns 201 with the created shortlist item', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain('profile-1'));
      const item = {
        id: 'sl-1', profileId: 'profile-1', targetProfileId: 'profile-2',
        note: 'nice profile', createdAt: new Date().toISOString(),
        name: null, age: null, city: null, primaryPhotoKey: null, verificationStatus: 'PENDING',
      };
      mockAddShortlist.mockResolvedValue(item);

      const app = await buildApp();
      const res = await request(app)
        .post('/shortlists/profile-2')
        .send({ note: 'nice profile' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.item.id).toBe('sl-1');
    });

    it('returns 400 when service throws SELF_SHORTLIST', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain('profile-1'));
      const error = Object.assign(new Error('Cannot shortlist yourself'), { code: 'SELF_SHORTLIST' });
      mockAddShortlist.mockRejectedValue(error);

      const app = await buildApp();
      const res = await request(app).post('/shortlists/profile-1').send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_SHORTLIST');
    });

    it('returns 404 when profile not found', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain(null));

      const app = await buildApp();
      const res = await request(app).post('/shortlists/profile-2').send({});

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /shortlists/:targetProfileId ───────────────────────────────────────

  describe('DELETE /shortlists/:targetProfileId', () => {
    it('returns 200 with removed: true when row was deleted', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain('profile-1'));
      mockRemoveShortlist.mockResolvedValue(true);

      const app = await buildApp();
      const res = await request(app).delete('/shortlists/profile-2');

      expect(res.status).toBe(200);
      expect(res.body.data.removed).toBe(true);
    });

    it('returns 200 with removed: false when row did not exist', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain('profile-1'));
      mockRemoveShortlist.mockResolvedValue(false);

      const app = await buildApp();
      const res = await request(app).delete('/shortlists/profile-999');

      expect(res.status).toBe(200);
      expect(res.body.data.removed).toBe(false);
    });

    it('returns 404 when profile not found', async () => {
      mockDbSelect.mockReturnValue(makeProfileResolverChain(null));

      const app = await buildApp();
      const res = await request(app).delete('/shortlists/profile-2');

      expect(res.status).toBe(404);
    });
  });
});
