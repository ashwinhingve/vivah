/**
 * FAQ (Function Attendance Quotient) API tests
 *
 * Tests the GET /weddings/:weddingId/ceremonies/:ceremonyId/faq
 * and GET /weddings/:weddingId/faq/summary endpoints.
 *
 * USE_MOCK_SERVICES=true — faqService stub is used; no real ai-service call.
 * All external dependencies are mocked so tests run without live infrastructure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockGetSession,
  mockRequireRole,
  mockRedisIncr,
  mockRedisExpire,
  mockRedisGet,
  mockRedisSet,
  mockExtract,
  mockExtractAllForWedding,
  mockPredictBatch,
} = vi.hoisted(() => ({
  mockGetSession:           vi.fn(),
  mockRequireRole:          vi.fn(),
  mockRedisIncr:            vi.fn().mockResolvedValue(1),
  mockRedisExpire:          vi.fn().mockResolvedValue(1),
  mockRedisGet:             vi.fn().mockResolvedValue(null),
  mockRedisSet:             vi.fn().mockResolvedValue('OK'),
  mockExtract:              vi.fn(),
  mockExtractAllForWedding: vi.fn(),
  mockPredictBatch:         vi.fn(),
}));

vi.mock('../auth/config.js', () => ({
  auth: {
    handler: vi.fn((_req: Request, res: Response) => { res.json({ success: true }); }),
    api: { getSession: mockGetSession },
  },
}));

vi.mock('better-auth/node', () => ({
  toNodeHandler: (authObj: { handler: (req: Request, res: Response) => void }) =>
    (req: Request, res: Response) => authObj.handler(req, res),
  fromNodeHeaders: vi.fn((h: Record<string, string>) => h),
}));

vi.mock('../auth/lastActive.js', () => ({ pingLastActive: vi.fn() }));

vi.mock('../lib/redis.js', () => ({
  redis: {
    incr:   mockRedisIncr,
    expire: mockRedisExpire,
    get:    mockRedisGet,
    set:    mockRedisSet,
  },
}));

vi.mock('../weddings/access.js', () => ({
  requireRole: mockRequireRole,
  getWeddingRole: vi.fn(),
}));

vi.mock('../services/faqFeatures.js', () => ({
  extract:              mockExtract,
  extractAllForWedding: mockExtractAllForWedding,
}));

vi.mock('../services/faqService.js', () => ({
  predictBatch: mockPredictBatch,
}));

// Stub all service imports that weddingRouter pulls in
vi.mock('../weddings/service.js', () => ({
  createWedding:         vi.fn(),
  getWedding:            vi.fn(),
  getBudget:             vi.fn(),
  updateWedding:         vi.fn(),
  updateBudget:          vi.fn(),
  getTaskBoard:          vi.fn(),
  createTask:            vi.fn(),
  updateTask:            vi.fn(),
  deleteTask:            vi.fn(),
  autoGenerateChecklist: vi.fn(),
  listUserWeddings:      vi.fn(),
  addCeremony:           vi.fn(),
  updateCeremony:        vi.fn(),
  deleteCeremony:        vi.fn(),
  getCeremonies:         vi.fn(),
  selectMuhurat:         vi.fn(),
  getMuhuratSuggestions: vi.fn(),
}));

vi.mock('../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  },
}));

// Import router after mocks
import { weddingRouter } from '../weddings/router.js';

// ── Test app factory ──────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/weddings', weddingRouter);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id:          'user_owner_abc',
  name:        'Test Owner',
  email:       'owner@test.com',
  role:        'INDIVIDUAL',
  status:      'ACTIVE',
  phoneNumber: '+919999999999',
};

const WEDDING_ID   = '550e8400-e29b-41d4-a716-446655440010';
const CEREMONY_ID  = '550e8400-e29b-41d4-a716-446655440011';
const CEREMONY_ID2 = '550e8400-e29b-41d4-a716-446655440012';

const MOCK_FEATURE_ROWS = [
  {
    guestId:    '550e8400-e29b-41d4-a716-446655440021',
    guestName:  'Priya Sharma',
    ceremonyId: CEREMONY_ID,
    rsvpRaw:    'YES',
    input: {
      relationship_type:          'close_family',
      distance_km:                750,
      rsvp_response:              'yes',
      ceremony_type:              'sangeet',
      historical_attendance_rate: 0.9,
    },
  },
  {
    guestId:    '550e8400-e29b-41d4-a716-446655440022',
    guestName:  'Rahul Mehta',
    ceremonyId: CEREMONY_ID,
    rsvpRaw:    'PENDING',
    input: {
      relationship_type:          'friend',
      distance_km:                750,
      rsvp_response:              'pending',
      ceremony_type:              'sangeet',
      historical_attendance_rate: null,
    },
  },
];

const MOCK_PREDICTIONS = [
  {
    guestId:              '550e8400-e29b-41d4-a716-446655440021',
    ceremonyId:           CEREMONY_ID,
    predictedProbability: 0.92,
    confidenceBand:       'high' as const,
    rsvpResponse:         'yes',
  },
  {
    guestId:              '550e8400-e29b-41d4-a716-446655440022',
    ceremonyId:           CEREMONY_ID,
    predictedProbability: 0.40,
    confidenceBand:       'medium' as const,
    rsvpResponse:         'pending',
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/weddings/:weddingId/ceremonies/:ceremonyId/faq', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default happy path
    mockGetSession.mockResolvedValue({ user: MOCK_USER, session: {} });
    mockRequireRole.mockResolvedValue('OWNER');
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockExtract.mockResolvedValue(MOCK_FEATURE_ROWS);
    mockPredictBatch.mockResolvedValue(MOCK_PREDICTIONS);
  });

  // ── Test 1: 200 with correctly-shaped payload ──────────────────────────────

  it('returns 200 with full FAQ payload for authenticated OWNER', async () => {
    const res = await request(buildApp())
      .get(`/api/v1/weddings/${WEDDING_ID}/ceremonies/${CEREMONY_ID}/faq`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data as {
      ceremony_id: string;
      ceremony_type: string;
      total_invited: number;
      predictions: Array<{
        guest_id: string;
        predicted_probability: number;
        confidence_band: string;
        rsvp_response: string;
      }>;
      summary: {
        expected_attendance: number;
        high_confidence_count: number;
        medium_confidence_count: number;
        low_confidence_count: number;
      };
    };

    // Shape checks
    expect(data.ceremony_id).toBe(CEREMONY_ID);
    expect(typeof data.ceremony_type).toBe('string');
    expect(Array.isArray(data.predictions)).toBe(true);
    expect(data.predictions).toHaveLength(2);
    expect(data.total_invited).toBe(data.predictions.length);

    // Each prediction has required fields
    for (const p of data.predictions) {
      expect(typeof p.guest_id).toBe('string');
      expect(typeof p.predicted_probability).toBe('number');
      expect(['high', 'medium', 'low']).toContain(p.confidence_band);
      expect(typeof p.rsvp_response).toBe('string');
    }

    // Summary.expected_attendance ≈ sum of probabilities
    const sumProbs = data.predictions.reduce((s, p) => s + p.predicted_probability, 0);
    expect(Math.abs(data.summary.expected_attendance - sumProbs)).toBeLessThan(0.001);

    // Confidence counts add up
    expect(
      data.summary.high_confidence_count +
      data.summary.medium_confidence_count +
      data.summary.low_confidence_count
    ).toBe(data.predictions.length);
  });

  // ── Test 2: 403/404 for non-member user ───────────────────────────────────

  it('returns 403 or 404 when user has no wedding role', async () => {
    mockRequireRole.mockRejectedValueOnce(
      Object.assign(new Error('Wedding not found'), { code: 'NOT_FOUND', status: 404 }),
    );

    const res = await request(buildApp())
      .get(`/api/v1/weddings/${WEDDING_ID}/ceremonies/${CEREMONY_ID}/faq`);

    expect([403, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // ── Test 3: 404 for unknown ceremony (no rows) ────────────────────────────

  it('returns 404 when ceremonyId has no invited guests', async () => {
    const unknownCeremonyId = '550e8400-e29b-41d4-a716-446655440099';
    mockExtract.mockResolvedValueOnce([]); // no rows → ceremony not found

    const res = await request(buildApp())
      .get(`/api/v1/weddings/${WEDDING_ID}/ceremonies/${unknownCeremonyId}/faq`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ── Summary endpoint tests ────────────────────────────────────────────────────

describe('GET /api/v1/weddings/:weddingId/faq/summary', () => {
  const CEREMONY2_ROWS = [
    {
      guestId:    '550e8400-e29b-41d4-a716-446655440031',
      guestName:  'Anita Kumar',
      ceremonyId: CEREMONY_ID2,
      rsvpRaw:    'YES',
      input: {
        relationship_type:          'extended_family',
        distance_km:                750,
        rsvp_response:              'yes',
        ceremony_type:              'reception',
        historical_attendance_rate: 0.75,
      },
    },
  ];

  const CEREMONY2_PREDS = [
    {
      guestId:              '550e8400-e29b-41d4-a716-446655440031',
      ceremonyId:           CEREMONY_ID2,
      predictedProbability: 0.92,
      confidenceBand:       'high' as const,
      rsvpResponse:         'yes',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSession.mockResolvedValue({ user: MOCK_USER, session: {} });
    mockRequireRole.mockResolvedValue('OWNER');
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');

    // Two ceremonies
    const ceremoniesMap = new Map([
      [CEREMONY_ID,  MOCK_FEATURE_ROWS],
      [CEREMONY_ID2, CEREMONY2_ROWS],
    ]);
    mockExtractAllForWedding.mockResolvedValue(ceremoniesMap);

    // predictBatch returns different results per ceremony
    mockPredictBatch
      .mockResolvedValueOnce(MOCK_PREDICTIONS)   // CEREMONY_ID
      .mockResolvedValueOnce(CEREMONY2_PREDS);   // CEREMONY_ID2
  });

  // ── Test 4: 200 with ceremonies array and catering count ──────────────────

  it('returns 200 with ceremonies array; estimated_catering_count = ceil(expected * 1.1)', async () => {
    const res = await request(buildApp())
      .get(`/api/v1/weddings/${WEDDING_ID}/faq/summary`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data as {
      wedding_id: string;
      ceremonies: Array<{
        ceremony_id:              string;
        ceremony_type:            string;
        total_invited:            number;
        expected_attendance:      number;
        estimated_catering_count: number;
      }>;
    };

    expect(data.wedding_id).toBe(WEDDING_ID);
    expect(Array.isArray(data.ceremonies)).toBe(true);
    expect(data.ceremonies.length).toBeGreaterThan(0);

    // Verify catering count formula for each ceremony
    for (const c of data.ceremonies) {
      expect(typeof c.ceremony_id).toBe('string');
      expect(typeof c.expected_attendance).toBe('number');
      expect(c.estimated_catering_count).toBe(
        Math.ceil(c.expected_attendance * 1.1),
      );
    }
  });

  // ── Test 5: Cache hit — predictBatch NOT called on second request ─────────

  it('serves cached response on second call without calling predictBatch', async () => {
    // Simulate cache miss on first call, then cache hit on second
    const cachedPayload = {
      wedding_id: WEDDING_ID,
      ceremonies: [
        {
          ceremony_id:              CEREMONY_ID,
          ceremony_type:            'sangeet',
          total_invited:            2,
          expected_attendance:      1.32,
          estimated_catering_count: 2,
        },
      ],
    };

    // First call: cache miss → build from features
    mockRedisGet.mockResolvedValueOnce(null);
    await request(buildApp())
      .get(`/api/v1/weddings/${WEDDING_ID}/faq/summary`);

    // Reset for second call: cache hit → cached JSON returned
    mockPredictBatch.mockClear();
    mockExtractAllForWedding.mockClear();
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedPayload));

    const res2 = await request(buildApp())
      .get(`/api/v1/weddings/${WEDDING_ID}/faq/summary`);

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    // predictBatch must NOT have been called — cache was served
    expect(mockPredictBatch).not.toHaveBeenCalled();
    // faqFeatures.extractAllForWedding must NOT have been called
    expect(mockExtractAllForWedding).not.toHaveBeenCalled();
  });

  // ── Test 6: Rate limit — 31st request returns 429 ────────────────────────

  it('returns 429 on the 31st request within the hour', async () => {
    // Simulate Redis counter already at 31
    mockRedisIncr.mockResolvedValueOnce(31);

    const res = await request(buildApp())
      .get(`/api/v1/weddings/${WEDDING_ID}/faq/summary`);

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('RATE_LIMITED');

    // Neither features nor predictions should be computed
    expect(mockExtractAllForWedding).not.toHaveBeenCalled();
    expect(mockPredictBatch).not.toHaveBeenCalled();
  });
});
