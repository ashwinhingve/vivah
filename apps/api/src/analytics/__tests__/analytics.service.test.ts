/**
 * Tests for analytics service and router.
 *
 * Mocks db (chainable proxy with FIFO queue), Better Auth, async handlers.
 * Verifies:
 *   - getDemandSeries returns monthly demand tuples
 *   - getRevenueSeries returns monthly revenue tuples
 *   - getVendorForecast returns utilization + revenue with 6-month projections
 *   - getAdminForecast returns demand + revenue with 6-month projections
 *   - GET /vendors/:vendorId/forecast requires owner or admin/support role
 *   - GET /admin/forecast requires admin/support role
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
      'set',
      'returning',
      'onConflictDoUpdate',
      'values',
      'select',
    ]) {
      p[m] = ret;
    }
    p.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve(dbState.queue.shift() ?? []));
    return p;
  };
  return { mockGetSession: vi.fn(), dbState, makeChain, mockLoggerError: vi.fn() };
});

vi.mock('../../auth/config.js', () => ({
  auth: {
    handler: vi.fn((_req: Request, res: Response) => {
      res.json({ success: true });
    }),
    api: { getSession: mockGetSession },
  },
}));

vi.mock('better-auth/node', () => ({
  toNodeHandler: (a: { handler: (r: Request, s: Response) => void }) =>
    (req: Request, res: Response) => a.handler(req, res),
  fromNodeHeaders: vi.fn((h: Record<string, string>) => h),
}));

vi.mock('../../auth/lastActive.js', () => ({ pingLastActive: vi.fn() }));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: () => makeChain(),
    insert: (_table: unknown) => makeChain(),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    error: mockLoggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { analyticsRouter } from '../analytics.router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/analytics', analyticsRouter);
  return app;
}

const ADMIN_USER = { id: 'admin_1', name: 'Admin', email: 'a@x', role: 'ADMIN', status: 'ACTIVE' };
const VENDOR_USER = { id: 'vendor_1', name: 'Vendor', email: 'v@x', role: 'VENDOR', status: 'ACTIVE' };
const SUPPORT_USER = { id: 'support_1', name: 'Support', email: 's@x', role: 'SUPPORT', status: 'ACTIVE' };
const OTHER_USER = { id: 'other_1', name: 'Other', email: 'o@x', role: 'INDIVIDUAL', status: 'ACTIVE' };

const VENDOR_ID = '550e8400-e29b-41d4-a716-446655440001';
const PROFILE_ID = '660e8400-e29b-41d4-a716-446655440001';

beforeEach(() => {
  dbState.queue = [];
  mockGetSession.mockReset();
  mockLoggerError.mockReset();
});

describe('GET /vendors/:vendorId/forecast', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockReturnValue(null);
    const app = buildApp();

    const res = await request(app).get(`/api/v1/analytics/vendors/${VENDOR_ID}/forecast`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid UUID vendorId', async () => {
    mockGetSession.mockReturnValue({ user: VENDOR_USER });
    const app = buildApp();

    const res = await request(app).get('/api/v1/analytics/vendors/not-a-uuid/forecast');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for non-existent vendor', async () => {
    mockGetSession.mockReturnValue({ user: VENDOR_USER });
    dbState.queue = [[]]; // no vendor found
    const app = buildApp();

    const res = await request(app).get(`/api/v1/analytics/vendors/${VENDOR_ID}/forecast`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('allows vendor owner to view their forecast', async () => {
    mockGetSession.mockReturnValue({ user: VENDOR_USER });
    // Vendor lookup returns the vendor with userId matching VENDOR_USER
    dbState.queue = [
      [{ id: VENDOR_ID, userId: VENDOR_USER.id, profileId: PROFILE_ID }], // vendor lookup
      [[]], // utilization series (empty)
      [[]], // revenue series (empty)
    ];
    const app = buildApp();

    const res = await request(app).get(`/api/v1/analytics/vendors/${VENDOR_ID}/forecast`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.utilization).toBeDefined();
    expect(res.body.data.revenue).toBeDefined();
  });

  it('allows admin to view any vendor forecast', async () => {
    mockGetSession.mockReturnValue({ user: ADMIN_USER });
    dbState.queue = [
      [{ id: VENDOR_ID, userId: VENDOR_USER.id, profileId: PROFILE_ID }], // vendor lookup
      [[]], // utilization series
      [[]], // revenue series
    ];
    const app = buildApp();

    const res = await request(app).get(`/api/v1/analytics/vendors/${VENDOR_ID}/forecast`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows support to view any vendor forecast', async () => {
    mockGetSession.mockReturnValue({ user: SUPPORT_USER });
    dbState.queue = [
      [{ id: VENDOR_ID, userId: VENDOR_USER.id, profileId: PROFILE_ID }],
      [[]],
      [[]],
    ];
    const app = buildApp();

    const res = await request(app).get(`/api/v1/analytics/vendors/${VENDOR_ID}/forecast`);

    expect(res.status).toBe(200);
  });

  it('denies non-owner non-staff from viewing vendor forecast', async () => {
    mockGetSession.mockReturnValue({ user: OTHER_USER });
    dbState.queue = [
      [{ id: VENDOR_ID, userId: VENDOR_USER.id, profileId: PROFILE_ID }], // vendor lookup: belongs to VENDOR_USER
    ];
    const app = buildApp();

    const res = await request(app).get(`/api/v1/analytics/vendors/${VENDOR_ID}/forecast`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns forecast with historical data and projections', async () => {
    mockGetSession.mockReturnValue({ user: VENDOR_USER });
    // Raw DB rows the service reads (util query aliases booked/max; revenue query aliases revenue).
    const utilRows = [
      { month: '2024-01', booked: 5, max: 10 },
      { month: '2024-02', booked: 6, max: 10 },
    ];
    const revenueRows = [
      { month: '2024-01', revenue: 50000 },
      { month: '2024-02', revenue: 60000 },
    ];
    // Expected mapped history the endpoint returns.
    const utilHistory = [
      { month: '2024-01', utilization: 0.5 },
      { month: '2024-02', utilization: 0.6 },
    ];
    const revenueHistory = revenueRows;
    dbState.queue = [
      [{ id: VENDOR_ID, userId: VENDOR_USER.id, profileId: PROFILE_ID }],
      utilRows, // utilization series (rows the util query returns)
      revenueRows, // vendor revenue series (rows the bookings query returns)
    ];
    const app = buildApp();

    const res = await request(app).get(`/api/v1/analytics/vendors/${VENDOR_ID}/forecast`);

    expect(res.status).toBe(200);
    expect(res.body.data.utilization.history).toEqual(utilHistory);
    expect(res.body.data.revenue.history).toEqual(revenueHistory);
    expect(res.body.data.utilization.forecast).toBeDefined();
    expect(res.body.data.utilization.forecast.length).toBe(6); // 6-month projection
    expect(res.body.data.revenue.forecast).toBeDefined();
    expect(res.body.data.revenue.forecast.length).toBe(6);
  });
});

describe('GET /admin/forecast', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockReturnValue(null);
    const app = buildApp();

    const res = await request(app).get('/api/v1/analytics/admin/forecast');

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin non-support user', async () => {
    mockGetSession.mockReturnValue({ user: OTHER_USER });
    const app = buildApp();

    const res = await request(app).get('/api/v1/analytics/admin/forecast');

    expect(res.status).toBe(403);
  });

  it('allows admin to view platform forecast', async () => {
    mockGetSession.mockReturnValue({ user: ADMIN_USER });
    const demandHistory = [
      { month: '2024-01', count: 100 },
      { month: '2024-02', count: 120 },
    ];
    const revenueHistory = [
      { month: '2024-01', revenue: 500000 },
      { month: '2024-02', revenue: 600000 },
    ];
    dbState.queue = [
      [demandHistory], // demand series
      [revenueHistory], // revenue series
    ];
    const app = buildApp();

    const res = await request(app).get('/api/v1/analytics/admin/forecast');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.demand).toBeDefined();
    expect(res.body.data.revenue).toBeDefined();
  });

  it('allows support to view platform forecast', async () => {
    mockGetSession.mockReturnValue({ user: SUPPORT_USER });
    dbState.queue = [
      [[]],
      [[]],
    ];
    const app = buildApp();

    const res = await request(app).get('/api/v1/analytics/admin/forecast');

    expect(res.status).toBe(200);
  });

  it('returns forecast with historical data and projections', async () => {
    mockGetSession.mockReturnValue({ user: ADMIN_USER });
    const demandHistory = [
      { month: '2024-01', count: 100 },
      { month: '2024-02', count: 110 },
      { month: '2024-03', count: 105 },
    ];
    const revenueHistory = [
      { month: '2024-01', revenue: 500000 },
      { month: '2024-02', revenue: 550000 },
      { month: '2024-03', revenue: 525000 },
    ];
    dbState.queue = [
      demandHistory, // demand series rows
      revenueHistory, // revenue series rows
    ];
    const app = buildApp();

    const res = await request(app).get('/api/v1/analytics/admin/forecast');

    expect(res.status).toBe(200);
    expect(res.body.data.demand.history).toEqual(demandHistory);
    expect(res.body.data.demand.forecast).toBeDefined();
    expect(res.body.data.demand.forecast.length).toBe(6);
    expect(res.body.data.revenue.history).toEqual(revenueHistory);
    expect(res.body.data.revenue.forecast).toBeDefined();
    expect(res.body.data.revenue.forecast.length).toBe(6);
  });
});
