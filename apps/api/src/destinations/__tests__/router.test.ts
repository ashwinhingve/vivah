/**
 * Destinations Router — auth, authorization, validation and status mapping.
 * Phase 8 Sprint I (Unit 8.1).
 *
 * The service is mocked here so this file tests the ROUTER's contract: who is
 * allowed in, what a malformed body does, how domain error codes map to HTTP
 * status, and that route declaration order is right. The service's real database
 * behaviour (guest tenancy, detach-not-delete, count correctness, the DB-enforced
 * invariants) is covered by the authenticated HTTP E2E against a live database —
 * mocking a transaction would only assert that the mock was called.
 *
 * Two traps this file deliberately avoids, both of which shipped in Sprint H:
 *   * The `authenticate` mock is NOT a pass-through. A pass-through lets the
 *     handler dereference req.user!.id on undefined and return 500 where
 *     production returns 401 — the 401 test would then pass for the wrong reason.
 *   * DestinationError is mocked as a REAL class, because the router narrows with
 *     `e instanceof DestinationError`. A plain object would make every domain
 *     error fall through to 500.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const WED   = '11111111-1111-4111-8111-111111111111';
const DEST  = '22222222-2222-4222-8222-222222222222';
const LEG   = '33333333-3333-4333-8333-333333333333';
const GUEST = '44444444-4444-4444-8444-444444444444';

// ── Service mock ─────────────────────────────────────────────────────────────

const mockList        = vi.fn();
const mockCreate      = vi.fn();
const mockDetail      = vi.fn();
const mockUpdate      = vi.fn();
const mockDelete      = vi.fn();
const mockSetPrimary  = vi.fn();
const mockReorder     = vi.fn();
const mockListTravel  = vi.fn();
const mockUpsertTrav  = vi.fn();
const mockDeleteTrav  = vi.fn();

class DestinationErrorMock extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DestinationError';
  }
}

vi.mock('../service.js', () => ({
  listDestinations:      (...a: unknown[]) => mockList(...a),
  createDestination:     (...a: unknown[]) => mockCreate(...a),
  getDestinationDetail:  (...a: unknown[]) => mockDetail(...a),
  updateDestination:     (...a: unknown[]) => mockUpdate(...a),
  deleteDestination:     (...a: unknown[]) => mockDelete(...a),
  setPrimaryDestination: (...a: unknown[]) => mockSetPrimary(...a),
  reorderDestinations:   (...a: unknown[]) => mockReorder(...a),
  listTravelLegs:        (...a: unknown[]) => mockListTravel(...a),
  upsertGuestTravelLeg:  (...a: unknown[]) => mockUpsertTrav(...a),
  deleteGuestTravelLeg:  (...a: unknown[]) => mockDeleteTrav(...a),
  DestinationError: DestinationErrorMock,
}));

// ── Wedding access mock ──────────────────────────────────────────────────────
// Mirrors the real helper: NOT_FOUND/404 when there is no access at all (so
// wedding existence does not leak), FORBIDDEN/403 when the role is too low.

const mockRequireRole = vi.fn();
vi.mock('../../weddings/access.js', () => ({
  requireRole: (...a: unknown[]) => mockRequireRole(...a),
}));

vi.mock('../../auth/middleware.js', () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false, data: null,
        error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' }, meta: {},
      });
      return;
    }
    next();
  },
}));

function appErr(code: string, status: number, message = code) {
  return Object.assign(new Error(message), { code, status });
}

async function buildApp(opts: { authenticated?: boolean } = {}) {
  const { destinationsRouter } = await import('../router.js');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (opts.authenticated !== false) {
      req.user = { id: 'user-1', role: 'INDIVIDUAL', status: 'ACTIVE', name: 'Test' } as never;
    }
    next();
  });
  app.use('/api/v1/weddings/:weddingId/destinations', destinationsRouter);
  return app;
}

const base = `/api/v1/weddings/${WED}/destinations`;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue('OWNER');
});

// ── Authentication ───────────────────────────────────────────────────────────

describe('authentication', () => {
  const cases: Array<[string, string, string]> = [
    ['GET',    base,                        'list'],
    ['POST',   base,                        'create'],
    ['POST',   `${base}/reorder`,           'reorder'],
    ['GET',    `${base}/${DEST}`,           'detail'],
    ['PUT',    `${base}/${DEST}`,           'update'],
    ['DELETE', `${base}/${DEST}`,           'delete'],
    ['POST',   `${base}/${DEST}/set-primary`, 'set-primary'],
    ['GET',    `${base}/${DEST}/travel`,    'list travel'],
    ['PUT',    `${base}/${DEST}/travel`,    'upsert travel'],
    ['DELETE', `${base}/${DEST}/travel/${LEG}`, 'delete travel'],
  ];

  it.each(cases)('%s %s (%s) returns 401 when unauthenticated', async (method, url) => {
    const app = await buildApp({ authenticated: false });
    const res = await request(app)[method.toLowerCase() as 'get'](url).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

// ── Authorization ────────────────────────────────────────────────────────────

describe('authorization', () => {
  it('returns 404 (not 403) when the caller has no access to the wedding', async () => {
    mockRequireRole.mockRejectedValue(appErr('NOT_FOUND', 404, 'Wedding not found'));
    const res = await request(await buildApp()).get(base);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns 403 when the role is too low for a write', async () => {
    mockRequireRole.mockRejectedValue(appErr('FORBIDDEN', 403, 'Forbidden'));
    const res = await request(await buildApp())
      .post(base)
      .send({ city: 'Udaipur', arriveOn: '2026-12-01', departOn: '2026-12-03' });
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('requires only VIEWER to read but EDITOR to write', async () => {
    const app = await buildApp();
    mockList.mockResolvedValue([]);
    await request(app).get(base);
    expect(mockRequireRole).toHaveBeenCalledWith(WED, 'user-1', 'VIEWER');

    mockCreate.mockResolvedValue({ id: DEST });
    await request(app).post(base).send({ city: 'Goa', arriveOn: '2026-12-01', departOn: '2026-12-02' });
    expect(mockRequireRole).toHaveBeenCalledWith(WED, 'user-1', 'EDITOR');
  });
});

// ── Success paths (assert real returned values, not merely "did not throw") ───

describe('success paths', () => {
  it('GET / returns the serialized legs', async () => {
    mockList.mockResolvedValue([
      { id: DEST, city: 'Udaipur', isPrimary: true, ceremonyCount: 2, travellerCount: 5 },
    ]);
    const res = await request(await buildApp()).get(base);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.destinations).toHaveLength(1);
    expect(res.body.data.destinations[0]).toMatchObject({
      city: 'Udaipur', ceremonyCount: 2, travellerCount: 5,
    });
  });

  it('POST / returns 201 and passes the parsed body through', async () => {
    mockCreate.mockResolvedValue({ id: DEST, city: 'Udaipur' });
    const res = await request(await buildApp())
      .post(base)
      .send({ city: 'Udaipur', arriveOn: '2026-12-04', departOn: '2026-12-07' });
    expect(res.status).toBe(201);
    expect(res.body.data.destination.city).toBe('Udaipur');
    expect(mockCreate).toHaveBeenCalledWith(WED, expect.objectContaining({
      city: 'Udaipur', countryCode: 'IN', ianaTimezone: 'Asia/Kolkata',
    }));
  });

  it('GET /:id returns destination, ceremonies and travel', async () => {
    mockDetail.mockResolvedValue({
      destination: { id: DEST, city: 'Delhi' },
      ceremonies: [{ id: 'c1', type: 'HALDI', date: '2026-12-20', venue: null, outsideWindow: true }],
      travel: [],
    });
    const res = await request(await buildApp()).get(`${base}/${DEST}`);
    expect(res.status).toBe(200);
    expect(res.body.data.destination.city).toBe('Delhi');
    expect(res.body.data.ceremonies[0].outsideWindow).toBe(true);
  });

  it('DELETE /:id reports how many ceremonies were detached', async () => {
    mockDelete.mockResolvedValue({ id: DEST, detachedCeremonies: 3 });
    const res = await request(await buildApp()).delete(`${base}/${DEST}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: DEST, detachedCeremonies: 3 });
  });

  it('POST /:id/set-primary returns the updated leg', async () => {
    mockSetPrimary.mockResolvedValue({ id: DEST, isPrimary: true });
    const res = await request(await buildApp()).post(`${base}/${DEST}/set-primary`);
    expect(res.status).toBe(200);
    expect(res.body.data.destination.isPrimary).toBe(true);
  });

  it('PUT /:id/travel upserts and echoes the guest name', async () => {
    mockUpsertTrav.mockResolvedValue({ id: LEG, guestId: GUEST, guestName: 'Asha' });
    const res = await request(await buildApp())
      .put(`${base}/${DEST}/travel`)
      .send({ guestId: GUEST, arrivalDate: '2026-12-04' });
    expect(res.status).toBe(200);
    expect(res.body.data.travel.guestName).toBe('Asha');
  });
});

// ── Routing order ────────────────────────────────────────────────────────────

describe('route declaration order', () => {
  it('POST /reorder hits the reorder handler, not /:id', async () => {
    mockReorder.mockResolvedValue([]);
    const res = await request(await buildApp())
      .post(`${base}/reorder`)
      .send({ order: [{ id: DEST, sortOrder: 0 }] });
    expect(res.status).toBe(200);
    expect(mockReorder).toHaveBeenCalled();
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe('validation', () => {
  it('rejects a reversed date window', async () => {
    const res = await request(await buildApp())
      .post(base)
      .send({ city: 'Backwards', arriveOn: '2026-12-10', departOn: '2026-12-01' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects an impossible calendar date', async () => {
    const res = await request(await buildApp())
      .post(base)
      .send({ city: 'X', arriveOn: '2026-02-31', departOn: '2026-03-01' });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects an unknown IANA timezone', async () => {
    const res = await request(await buildApp())
      .post(base)
      .send({ city: 'X', ianaTimezone: 'Mars/Olympus', arriveOn: '2026-12-01', departOn: '2026-12-02' });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a malformed clock time on travel', async () => {
    const res = await request(await buildApp())
      .put(`${base}/${DEST}/travel`)
      .send({ guestId: GUEST, arrivalTime: '25:00' });
    expect(res.status).toBe(400);
    expect(mockUpsertTrav).not.toHaveBeenCalled();
  });

  it('rejects a malformed uuid path segment before touching the service', async () => {
    const res = await request(await buildApp()).get(`/api/v1/weddings/${WED}/destinations/not-a-uuid`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
    expect(mockDetail).not.toHaveBeenCalled();
  });
});

// ── Domain error -> HTTP status mapping ──────────────────────────────────────

describe('error mapping', () => {
  it('maps GUEST_NOT_IN_WEDDING to 404', async () => {
    mockUpsertTrav.mockRejectedValue(
      new DestinationErrorMock('GUEST_NOT_IN_WEDDING', 'Guest does not belong to this wedding'),
    );
    const res = await request(await buildApp())
      .put(`${base}/${DEST}/travel`)
      .send({ guestId: GUEST });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('GUEST_NOT_IN_WEDDING');
  });

  it('maps DUPLICATE_PRIMARY to 409, not 500', async () => {
    mockCreate.mockRejectedValue(
      new DestinationErrorMock('DUPLICATE_PRIMARY', 'This wedding already has a primary destination'),
    );
    const res = await request(await buildApp())
      .post(base)
      .send({ city: 'Second', arriveOn: '2026-12-01', departOn: '2026-12-02', isPrimary: true });
    expect(res.status).toBe(409);
  });

  it('maps INVALID_DATE_RANGE to 400 (the CHECK-constraint path Zod cannot see)', async () => {
    mockUpdate.mockRejectedValue(
      new DestinationErrorMock('INVALID_DATE_RANGE', 'Departure must be on or after arrival'),
    );
    const res = await request(await buildApp()).put(`${base}/${DEST}`).send({ arriveOn: '2027-01-01' });
    expect(res.status).toBe(400);
  });

  it('maps NOT_FOUND from reorder to 404', async () => {
    mockReorder.mockRejectedValue(
      new DestinationErrorMock('NOT_FOUND', 'One or more destinations do not belong to this wedding'),
    );
    const res = await request(await buildApp())
      .post(`${base}/reorder`)
      .send({ order: [{ id: DEST, sortOrder: 0 }] });
    expect(res.status).toBe(404);
  });

  it('surfaces an unexpected error as 500 rather than reshaping it', async () => {
    mockList.mockRejectedValue(new Error('connection terminated'));
    const res = await request(await buildApp()).get(base);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
