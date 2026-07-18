/**
 * Reports Router Integration Tests
 *
 * Tests the authentication, authorization, and PDF streaming behavior of:
 *   GET /vendor/:vendorId/report   — vendor report (owner or admin/support)
 *   GET /admin/platform-report      — platform report (admin/support only)
 *
 * Auth/authz scenarios:
 *   - 401 unauthenticated
 *   - 403 non-owner, non-staff
 *   - 200 owner / admin / support
 *   - 404 vendor not found
 *   - 400 malformed vendorId
 *
 * PDF generation is NOT mocked — tests verify actual PDFKit buffer rendering
 * by asserting the response starts with %PDF- magic bytes and Content-Type is
 * application/pdf.
 *
 * Note: The %PDF- check in passing tests confirms REAL PDF generation via PDFKit,
 * not a mock — the buffer is actually rendered, not stubbed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

// Analytics service — mocked to return deterministic forecast data
const mockGetAdminForecast = vi.fn();
const mockGetVendorForecast = vi.fn();

vi.mock('../../analytics/analytics.service.js', () => ({
  getAdminForecast: mockGetAdminForecast,
  getVendorForecast: mockGetVendorForecast,
  // Must be a real class: reports.service.ts narrows errors with
  // `e instanceof AnalyticsServiceError`. Omitting it makes the right-hand side
  // undefined, which throws "not callable" and turns every error path into a 500.
  AnalyticsServiceError: class AnalyticsServiceError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'AnalyticsServiceError';
    }
  },
}));

// Database — mocked for vendor lookup
const mockDbSelect = vi.fn();
vi.mock('../../lib/db.js', () => ({ db: { select: mockDbSelect } }));

vi.mock('@smartshaadi/db', () => ({
  vendors: {},
  profiles: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({ type: 'eq' })),
  innerJoin: vi.fn(),
}));

// Mock auth middleware — enforce auth logic based on req.user set by buildApp
vi.mock('../../auth/middleware.js', () => ({
  // Mirrors the real authenticate: reject before the handler when there is no
  // session. A pass-through here would let the vendor route dereference
  // req.user!.role on undefined and surface a 500 where production returns 401.
  authenticate: (req: any, res: any, next: any) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' },
        meta: {},
      });
      return;
    }
    next();
  },
  authorize: (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      // Check if user is authenticated and has required role
      if (!req.user) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' }, meta: {} });
        return;
      }
      if (!roles.includes(req.user.role)) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' }, meta: {} });
        return;
      }
      next();
    };
  },
}));

// env.ts — will be mocked dynamically in tests
vi.mock('../../lib/env.js', () => ({
  areReportsEnabled: true,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────


// ── Test Setup ────────────────────────────────────────────────────────────────

const VENDOR_ID = '22222222-2222-4222-8222-222222222222';
const VENDOR_PROFILE_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_USER_ID = 'owner-1';
const ADMIN_USER_ID = 'admin-1';
const OTHER_USER_ID = 'other-1';

interface BuildAppOptions {
  userRole?: string | null;  // null = unauthenticated, undefined = skip auth entirely
  userId?: string;
  skipAuth?: boolean;
}

async function buildApp(opts: BuildAppOptions = {}) {
  const { reportsRouter } = await import('../reports.router.js');
  const app = express();
  app.use(express.json());

  // Custom auth middleware that injects req.user based on test scenario
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (opts.skipAuth) {
      // Don't set req.user, simulating unauthenticated request
    } else if (opts.userRole !== undefined) {
      req.user = {
        id: opts.userId || 'test-user',
        role: opts.userRole || 'INDIVIDUAL',
        status: 'ACTIVE',
        name: 'Test User',
      };
    } else {
      // Default authenticated user
      req.user = {
        id: opts.userId || 'test-user',
        role: 'INDIVIDUAL',
        status: 'ACTIVE',
        name: 'Test User',
      };
    }
    next();
  });

  app.use('/reports', reportsRouter);
  return app;
}

/**
 * Stands in for the drizzle query builder the vendor route uses:
 *   db.select(...).from(...).innerJoin(...).where(...).limit(1)
 * Every builder method returns the same chain; only .limit() resolves, to the
 * row array (empty when the vendor should not be found).
 */
function makeVendorResolverChain(vendorData: Record<string, unknown> | null) {
  const chain = {
    from:      vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where:     vi.fn(() => chain),
    limit:     vi.fn().mockResolvedValue(vendorData ? [vendorData] : []),
  };
  return chain;
}

/** Platform shape — what getAdminForecast() returns (demand + revenue). */
function mockForecastData() {
  return {
    demand: {
      history: [{ month: '2026-05', count: 10 }],
      forecast: [11, 12, 13, 14, 15, 16],
      level: 10,
    },
    revenue: {
      history: [{ month: '2026-05', revenue: 100000 }],
      forecast: [110000, 120000, 130000, 140000, 150000, 160000],
      level: 100000,
    },
  };
}

/**
 * Vendor shape — what getVendorForecast() returns (utilization + revenue).
 * Distinct from the platform shape: feeding the platform shape to
 * generateVendorReport leaves `utilization` undefined and the render throws.
 */
function mockVendorForecastData() {
  return {
    utilization: {
      history: [{ month: '2026-05', utilization: 0.42 }],
      forecast: [0.45, 0.48, 0.5, 0.52, 0.55, 0.58],
      level: 0.42,
    },
    revenue: {
      history: [{ month: '2026-05', revenue: 100000 }],
      forecast: [110000, 120000, 130000, 140000, 150000, 160000],
      level: 100000,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('reports router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /reports/vendor/:vendorId/report ──────────────────────────────────

  describe('GET /reports/vendor/:vendorId/report', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = await buildApp({ skipAuth: true });

      const res = await request(app).get(`/reports/vendor/${VENDOR_ID}/report`);

      expect(res.status).toBe(401);
    });

    it('returns 400 when vendorId is not a valid UUID', async () => {
      const app = await buildApp();

      const res = await request(app).get('/reports/vendor/not-a-uuid/report');

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toMatch(/VALIDATION|INVALID/i);
    });

    it('returns 404 when vendor not found', async () => {
      mockDbSelect.mockReturnValue(makeVendorResolverChain(null));

      const app = await buildApp({ userId: OWNER_USER_ID, userRole: 'INDIVIDUAL' });

      const res = await request(app).get(`/reports/vendor/${VENDOR_ID}/report`);

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('NOT_FOUND');
    });

    it('returns 403 when authenticated user is not owner and not staff', async () => {
      const vendorData = {
        id: VENDOR_ID,
        userId: OWNER_USER_ID,
        profileId: VENDOR_PROFILE_ID,
        businessName: 'Test Vendor',
      };
      mockDbSelect.mockReturnValue(makeVendorResolverChain(vendorData));

      const app = await buildApp({ userId: OTHER_USER_ID, userRole: 'INDIVIDUAL' });

      const res = await request(app).get(`/reports/vendor/${VENDOR_ID}/report`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('returns 200 with PDF when owner requests their own vendor report', async () => {
      const vendorData = {
        id: VENDOR_ID,
        userId: OWNER_USER_ID,
        profileId: VENDOR_PROFILE_ID,
        businessName: 'Test Vendor',
      };
      mockDbSelect.mockReturnValue(makeVendorResolverChain(vendorData));
      mockGetVendorForecast.mockResolvedValue(mockVendorForecastData());

      const app = await buildApp({ userId: OWNER_USER_ID, userRole: 'INDIVIDUAL' });

      const res = await request(app).get(`/reports/vendor/${VENDOR_ID}/report`);

      expect(res.status).toBe(200);
      expect(res.type).toBe('application/pdf');
      // Verify it's a real PDF buffer (starts with %PDF- magic bytes)
      expect(res.body.toString('latin1')).toMatch(/^%PDF-/);
      // Verify Content-Disposition header
      expect(res.get('Content-Disposition')).toMatch(/attachment.*vendor-report/);
    });

    it('returns 200 with PDF when ADMIN user requests any vendor report', async () => {
      const vendorData = {
        id: VENDOR_ID,
        userId: OWNER_USER_ID,
        profileId: VENDOR_PROFILE_ID,
        businessName: 'Test Vendor',
      };
      mockDbSelect.mockReturnValue(makeVendorResolverChain(vendorData));
      mockGetVendorForecast.mockResolvedValue(mockVendorForecastData());

      const app = await buildApp({ userId: ADMIN_USER_ID, userRole: 'ADMIN' });

      const res = await request(app).get(`/reports/vendor/${VENDOR_ID}/report`);

      expect(res.status).toBe(200);
      expect(res.type).toBe('application/pdf');
      expect(res.body.toString('latin1')).toMatch(/^%PDF-/);
    });

    it('returns 200 with PDF when SUPPORT user requests any vendor report', async () => {
      const vendorData = {
        id: VENDOR_ID,
        userId: OWNER_USER_ID,
        profileId: VENDOR_PROFILE_ID,
        businessName: 'Test Vendor',
      };
      mockDbSelect.mockReturnValue(makeVendorResolverChain(vendorData));
      mockGetVendorForecast.mockResolvedValue(mockVendorForecastData());

      const app = await buildApp({ userId: 'support-1', userRole: 'SUPPORT' });

      const res = await request(app).get(`/reports/vendor/${VENDOR_ID}/report`);

      expect(res.status).toBe(200);
      expect(res.type).toBe('application/pdf');
      expect(res.body.toString('latin1')).toMatch(/^%PDF-/);
    });

    // Note: Kill-switch behavior (503 when REPORTS_ENABLED=false) requires env var
    // control and is tested via environment integration tests with NODE_ENV in CI,
    // not in unit mocks. The middleware is verified to be in place in router.ts.
  });

  // ── GET /reports/admin/platform-report ────────────────────────────────────

  describe('GET /reports/admin/platform-report', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = await buildApp({ skipAuth: true });

      const res = await request(app).get('/reports/admin/platform-report');

      expect(res.status).toBe(401);
    });

    it('returns 403 when user is INDIVIDUAL (not admin/support)', async () => {
      const app = await buildApp({ userId: 'user-1', userRole: 'INDIVIDUAL' });

      const res = await request(app).get('/reports/admin/platform-report');

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('returns 200 with PDF when ADMIN user requests platform report', async () => {
      mockGetAdminForecast.mockResolvedValue(mockForecastData());

      const app = await buildApp({ userId: ADMIN_USER_ID, userRole: 'ADMIN' });

      const res = await request(app).get('/reports/admin/platform-report');

      expect(res.status).toBe(200);
      expect(res.type).toBe('application/pdf');
      // Verify it's a real PDF buffer (starts with %PDF- magic bytes)
      expect(res.body.toString('latin1')).toMatch(/^%PDF-/);
      // Verify Content-Disposition header
      expect(res.get('Content-Disposition')).toMatch(/attachment.*platform-report/);
    });

    it('returns 200 with PDF when SUPPORT user requests platform report', async () => {
      mockGetAdminForecast.mockResolvedValue(mockForecastData());

      const app = await buildApp({ userId: 'support-1', userRole: 'SUPPORT' });

      const res = await request(app).get('/reports/admin/platform-report');

      expect(res.status).toBe(200);
      expect(res.type).toBe('application/pdf');
      expect(res.body.toString('latin1')).toMatch(/^%PDF-/);
    });

    // Note: Kill-switch behavior (503 when REPORTS_ENABLED=false) tested via
    // environment integration tests in CI, not unit mocks.
  });
});
