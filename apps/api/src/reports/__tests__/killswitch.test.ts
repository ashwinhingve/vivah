/**
 * Reports kill-switch tests (Phase 8 Sprint H, Unit 8.3).
 *
 * REPORTS_ENABLED is the load-shedding lever for the synchronous PDFKit render.
 * When it is off, BOTH report routes must return 503 — and must do so before any
 * authentication or database work, so shedding load actually sheds the work.
 *
 * This lives in its own file because `areReportsEnabled` is read once at module
 * scope; router.test.ts mocks it to `true` for every case in that file, so the
 * false case cannot be expressed there.
 */

import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// The switch under test — off.
vi.mock('../../lib/env.js', () => ({ areReportsEnabled: false }));

// If the 503 guard works, none of the below is ever reached. Each is mocked to
// throw, so a regression that lets a request past the guard fails loudly rather
// than silently succeeding.
vi.mock('../../auth/middleware.js', () => ({
  authenticate: () => {
    throw new Error('authenticate must not run when reports are disabled');
  },
  authorize: () => () => {
    throw new Error('authorize must not run when reports are disabled');
  },
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: () => {
      throw new Error('db must not be queried when reports are disabled');
    },
  },
}));

vi.mock('@smartshaadi/db', () => ({ vendors: {}, profiles: {} }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), innerJoin: vi.fn() }));

const VENDOR_ID = '22222222-2222-4222-8222-222222222222';

async function buildApp() {
  const { reportsRouter } = await import('../reports.router.js');
  const app = express();
  app.use('/reports', reportsRouter);
  return app;
}

describe('reports kill-switch (REPORTS_ENABLED=false)', () => {
  it('returns 503 on the vendor report route', async () => {
    const app = await buildApp();

    const res = await request(app).get(`/reports/vendor/${VENDOR_ID}/report`);

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns 503 on the platform report route', async () => {
    const app = await buildApp();

    const res = await request(app).get('/reports/admin/platform-report');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('sheds load before authenticating or touching the database', async () => {
    // The auth + db mocks above throw if invoked. Reaching a clean 503 proves the
    // guard short-circuits ahead of both — otherwise this surfaces as a 500.
    const app = await buildApp();

    const res = await request(app).get(`/reports/vendor/${VENDOR_ID}/report`);

    expect(res.status).toBe(503);
  });
});
