/**
 * Admin Analytics API tests.
 *
 * Covers the six admin-only aggregation endpoints under
 *   GET /api/v1/admin/analytics/*
 *
 * Better Auth, db and logger are mocked so tests run with no live infra.
 * The db mock is a chainable proxy whose terminal await pops the next
 * pre-queued result batch (FIFO) — one shift per `await db.select()...`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

const { mockGetSession, dbState, makeChain, mockLoggerError } = vi.hoisted(() => {
  const dbState = { queue: [] as unknown[][] };
  const makeChain = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = {};
    const ret = () => p;
    for (const m of [
      'from',
      'where',
      'groupBy',
      'orderBy',
      'innerJoin',
      'leftJoin',
      'rightJoin',
      'limit',
      'offset',
      'having',
    ]) {
      p[m] = ret;
    }
    p.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve(dbState.queue.shift() ?? []));
    return p;
  };
  return {
    mockGetSession: vi.fn(),
    dbState,
    makeChain,
    mockLoggerError: vi.fn(),
  };
});

vi.mock('../auth/config.js', () => ({
  auth: {
    handler: vi.fn((_req: Request, res: Response) => {
      res.json({ success: true });
    }),
    api: { getSession: mockGetSession },
  },
}));

vi.mock('better-auth/node', () => ({
  toNodeHandler:
    (authObj: { handler: (req: Request, res: Response) => void }) =>
    (req: Request, res: Response) =>
      authObj.handler(req, res),
  fromNodeHeaders: vi.fn((h: Record<string, string>) => h),
}));

vi.mock('../auth/lastActive.js', () => ({ pingLastActive: vi.fn() }));

vi.mock('../lib/db.js', () => ({ db: { select: () => makeChain() } }));

vi.mock('../lib/logger.js', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// vi.mock() above is hoisted, so a normal static import still sees the mocks
// (same pattern as stay.test.ts). Top-level await fails tsc under CJS module
// resolution even though vitest runs the file as ESM.
import { adminAnalyticsRouter } from '../admin/analytics.router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminAnalyticsRouter);
  return app;
}

const ADMIN_USER = {
  id: 'admin_abc123',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
};
const REGULAR_USER = {
  id: 'user_zzz999',
  name: 'Reg',
  email: 'reg@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
};

beforeEach(() => {
  dbState.queue = [];
  mockGetSession.mockReset();
  mockLoggerError.mockReset();
});

describe('GET /api/v1/admin/analytics/overview', () => {
  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await request(buildApp()).get('/api/v1/admin/analytics/overview');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for a non-ADMIN role', async () => {
    mockGetSession.mockResolvedValueOnce({ user: REGULAR_USER, session: {} });
    const res = await request(buildApp()).get('/api/v1/admin/analytics/overview');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with the four KPI blocks and MoM trend for an ADMIN', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    dbState.queue = [
      [{ total: '120', thisM: '20', prevM: '10' }], // users
      [{ total: '45', thisM: '12', prevM: '12' }], // matches
      [{ thisM: '14997.00', prevM: '9990.00' }], // payments
      [{ all: '72.4', thisM: '75', prevM: '70' }], // compat
    ];
    const res = await request(buildApp()).get('/api/v1/admin/analytics/overview');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalUsers.value).toBe(120);
    expect(res.body.data.totalUsers.trend).toBe('up'); // 20 vs 10
    expect(res.body.data.activeMatches.value).toBe(45);
    expect(res.body.data.activeMatches.trend).toBe('flat'); // 12 vs 12
    expect(res.body.data.revenueMtd.value).toBe(14997);
    expect(res.body.data.avgCompatScore.value).toBe(72.4);
  });
});

describe('GET /api/v1/admin/analytics/signups', () => {
  it('returns a zero-filled daily series of {date,count}', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    dbState.queue = [[{ date: '2026-05-18', count: '4' }]];
    const res = await request(buildApp()).get('/api/v1/admin/analytics/signups?days=7');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(7);
    for (const row of res.body.data.data) {
      expect(row).toHaveProperty('date');
      expect(typeof row.count).toBe('number');
    }
    expect(res.body.meta.days).toBe(7);
  });
});

describe('GET /api/v1/admin/analytics/matches', () => {
  it('returns weekly {week,sent,accepted} buckets', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    dbState.queue = [
      [{ week: '2026-W20', n: '9' }], // sent
      [{ week: '2026-W20', n: '4' }], // accepted
    ];
    const res = await request(buildApp()).get('/api/v1/admin/analytics/matches?weeks=4');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    for (const row of res.body.data.data) {
      expect(row).toHaveProperty('week');
      expect(typeof row.sent).toBe('number');
      expect(typeof row.accepted).toBe('number');
    }
  });
});

describe('GET /api/v1/admin/analytics/stay-quotient', () => {
  it('returns all four engagement tiers, zero-filled', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    dbState.queue = [
      [
        { tier: 'ENGAGED', count: '30' },
        { tier: 'HIGH_RISK', count: '5' },
      ],
    ];
    const res = await request(buildApp()).get('/api/v1/admin/analytics/stay-quotient');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.basis).toBe('engagement-activity');
    const tiers = res.body.data.data.map((d: { tier: string }) => d.tier);
    expect(tiers).toEqual(['ENGAGED', 'LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK']);
    const engaged = res.body.data.data.find((d: { tier: string }) => d.tier === 'ENGAGED');
    expect(engaged.count).toBe(30);
  });
});

describe('GET /api/v1/admin/analytics/top-matches', () => {
  it('returns rows with a derived FII band and is admin-gated', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    dbState.queue = [
      [
        {
          userA: 'Asha',
          userB: 'Vikram',
          totalScore: 91,
          gunaMilanScore: 28,
          fiiScore: 82,
          computedAt: new Date('2026-05-10T00:00:00Z'),
        },
        {
          userA: 'Neha',
          userB: 'Raj',
          totalScore: 88,
          gunaMilanScore: 24,
          fiiScore: null,
          computedAt: new Date('2026-05-09T00:00:00Z'),
        },
      ],
    ];
    const res = await request(buildApp()).get('/api/v1/admin/analytics/top-matches');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data[0].fiiBand).toBe('Very High Family Inclination');
    expect(res.body.data.data[1].fiiBand).toBe('N/A');
    expect(res.body.data.data[0].totalScore).toBe(91);
  });

  it('returns 403 for a non-ADMIN role', async () => {
    mockGetSession.mockResolvedValueOnce({ user: REGULAR_USER, session: {} });
    const res = await request(buildApp()).get('/api/v1/admin/analytics/top-matches');
    expect(res.status).toBe(403);
  });
});
