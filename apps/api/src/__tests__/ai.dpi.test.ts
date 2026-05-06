/**
 * DPI (Divorce Probability Indicator) API tests
 *
 * Tests the GET /api/v1/ai/divorce-indicator/:matchId endpoint and the
 * extractFeatures() helper in dpiFeatures.ts.
 *
 * All external dependencies are mocked so tests run without live infrastructure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

const {
  mockGetSession,
  mockDbSelect,
  mockResolveProfileId,
  mockRedisIncr,
  mockRedisExpire,
  mockRedisGet,
  mockRedisSet,
  mockRedisTtl,
  mockGetDivorceProbability,
  mockAssertRequesterParticipation,
  mockExtractFeatures,
  mockLoggerInfo,
} = vi.hoisted(() => ({
  mockGetSession:                    vi.fn(),
  mockDbSelect:                      vi.fn(),
  mockResolveProfileId:              vi.fn(),
  mockRedisIncr:                     vi.fn().mockResolvedValue(1),
  mockRedisExpire:                   vi.fn().mockResolvedValue(1),
  mockRedisGet:                      vi.fn().mockResolvedValue(null),
  mockRedisSet:                      vi.fn().mockResolvedValue('OK'),
  mockRedisTtl:                      vi.fn().mockResolvedValue(0),
  mockGetDivorceProbability:         vi.fn(),
  mockAssertRequesterParticipation:  vi.fn(),
  mockExtractFeatures:               vi.fn(),
  mockLoggerInfo:                    vi.fn(),
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

// DB mock — chainable .from().where().limit()
vi.mock('../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockDbSelect,
        })),
      })),
    })),
  },
}));

vi.mock('../lib/profile.js', () => ({ resolveProfileId: mockResolveProfileId }));

vi.mock('../lib/redis.js', () => ({
  redis: {
    incr:   mockRedisIncr,
    expire: mockRedisExpire,
    get:    mockRedisGet,
    set:    mockRedisSet,
    ttl:    mockRedisTtl,
    // Also needed for extractFeatures → emotional score lookup
    zadd:              vi.fn().mockResolvedValue(1),
    zremrangebyscore:  vi.fn().mockResolvedValue(0),
    zrange:            vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: {
    findOne: vi.fn(() => ({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
    })),
  },
}));

vi.mock('../infrastructure/mongo/models/Chat.js', () => ({
  Chat: {
    findOne: vi.fn(() => ({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
    })),
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: mockLoggerInfo, error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Mock the AI service client ────────────────────────────────────────────────
vi.mock('../services/aiService.js', () => ({
  getConversationSuggestions: vi.fn(),
  getEmotionalScore:          vi.fn(),
  getDivorceProbability:      mockGetDivorceProbability,
}));

// ── Mock dpiPrivacy.ts (assertRequesterParticipation, buildCacheKey, sanitizeForLogging) ──
vi.mock('../services/dpiPrivacy.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/dpiPrivacy.js')>();
  return {
    ...original,
    // Keep DpiPrivacyError, buildCacheKey, sanitizeForLogging as-is (real implementation)
    assertRequesterParticipation: mockAssertRequesterParticipation,
  };
});

// ── Mock dpiFeatures.ts ───────────────────────────────────────────────────────
vi.mock('../services/dpiFeatures.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/dpiFeatures.js')>();
  return {
    ...original,
    extractFeatures: mockExtractFeatures,
  };
});

// ── Import modules after mocks ────────────────────────────────────────────────

import { aiRouter } from '../routes/ai.js';
import type { DpiProfile } from '../services/dpiFeatures.js';
import { DpiPrivacyError } from '../services/dpiPrivacy.js';

// ── Test app factory ──────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/ai', aiRouter);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'user_abc123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
  phoneNumber: '+919999999999',
};

const MOCK_PROFILE_ID  = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_PROFILE_ID = '550e8400-e29b-41d4-a716-446655440002';
const MATCH_ID         = '550e8400-e29b-41d4-a716-446655440003';

const MOCK_DPI_RESPONSE = {
  score: 0.22,
  level: 'LOW' as const,
  label: 'Strong Compatibility',
  narrative: 'You and your partner share strong values and communication styles.',
  suggestion: 'Continue building on your shared interests and open dialogue.',
  top_factors: [
    { factor: 'family_values_alignment', weight: 0.85, direction: 'positive' },
    { factor: 'lifestyle_compatibility', weight: 0.80, direction: 'positive' },
  ],
  shared_strengths: ['travel', 'cooking'],
  disclaimer: 'This indicator is generated by AI using statistical patterns.',
  computed_at: '2026-05-06T10:00:00.000Z',
};

const MOCK_FEATURES = {
  age_gap_years:           0.0,
  education_gap:           0.3,
  income_disparity_pct:    0.15,
  family_values_alignment: 0.0,
  lifestyle_compatibility: 0.1,
  communication_score:     0.2,
  guna_milan_score:        0.3,
  geographic_distance_km:  0.1,
  religion_caste_match:    0.0,
  preference_match_pct:    0.2,
};

// ── DB mock helpers ───────────────────────────────────────────────────────────

function setupParticipantMocks() {
  // assertRequesterParticipation mocked externally, but db.select still called
  // for callerPgProfile and otherPgProfile lookups in the route handler
  mockDbSelect
    .mockResolvedValueOnce([{
      id:        MOCK_PROFILE_ID,
      userId:    MOCK_USER.id,
      latitude:  '18.5204',
      longitude: '73.8567',
    }])
    .mockResolvedValueOnce([{
      id:        OTHER_PROFILE_ID,
      userId:    'user_other456',
      latitude:  '19.0760',
      longitude: '72.8777',
    }]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/ai/divorce-indicator/:matchId', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisTtl.mockResolvedValue(0);
    mockResolveProfileId.mockResolvedValue(MOCK_PROFILE_ID);
    mockGetDivorceProbability.mockResolvedValue(MOCK_DPI_RESPONSE);
    mockAssertRequesterParticipation.mockResolvedValue({ otherProfileId: OTHER_PROFILE_ID });
    mockExtractFeatures.mockResolvedValue(MOCK_FEATURES);
  });

  // ── Test 1: 401 without session ─────────────────────────────────────────────
  it('returns 401 when no session cookie is present', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/divorce-indicator/${MATCH_ID}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── Test 2: 403 DPI_PRIVACY_VIOLATION for non-participant ───────────────────
  it('returns 403 with DPI_PRIVACY_VIOLATION when user is not a match participant', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockAssertRequesterParticipation.mockRejectedValueOnce(
      new DpiPrivacyError('Not a participant in this match'),
    );

    const res = await request(buildApp())
      .get(`/api/v1/ai/divorce-indicator/${MATCH_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('DPI_PRIVACY_VIOLATION');
  });

  // ── Test 3: 404 for PENDING match (NOT 403 — existence leak prevention) ─────
  it('returns 404 (not 403) for a PENDING/non-ACCEPTED match to prevent existence leaks', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });

    // assertRequesterParticipation throws MATCH_NOT_FOUND for pending/rejected matches
    const notFoundErr = new Error('Match not found') as Error & {
      code: string;
      status: number;
    };
    notFoundErr.code = 'MATCH_NOT_FOUND';
    notFoundErr.status = 404;
    mockAssertRequesterParticipation.mockRejectedValueOnce(notFoundErr);

    const res = await request(buildApp())
      .get(`/api/v1/ai/divorce-indicator/${MATCH_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('MATCH_NOT_FOUND');
    // CRITICAL: must NOT be 403 — that would leak existence of the match
    expect(res.status).not.toBe(403);
  });

  // ── Test 4: 200 with full DpiResponse for valid request ─────────────────────
  it('returns 200 with full DpiResponse when auth and match are valid', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupParticipantMocks();

    const res = await request(buildApp())
      .get(`/api/v1/ai/divorce-indicator/${MATCH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as typeof MOCK_DPI_RESPONSE;
    expect(typeof data.score).toBe('number');
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(data.level);
    expect(typeof data.label).toBe('string');
    expect(typeof data.narrative).toBe('string');
    expect(typeof data.suggestion).toBe('string');
    expect(Array.isArray(data.top_factors)).toBe(true);
    expect(Array.isArray(data.shared_strengths)).toBe(true);
    expect(typeof data.disclaimer).toBe('string');
    expect(typeof data.computed_at).toBe('string');
    expect(mockGetDivorceProbability).toHaveBeenCalledOnce();
  });

  // ── Test 5: cache hit returns cached value without calling AI service ────────
  it('returns cached DPI response without calling AI service when Redis has a fresh entry', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    // Redis cache hit
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(MOCK_DPI_RESPONSE));

    const res = await request(buildApp())
      .get(`/api/v1/ai/divorce-indicator/${MATCH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBe(MOCK_DPI_RESPONSE.score);
    // AI service must NOT be called — cache served
    expect(mockGetDivorceProbability).not.toHaveBeenCalled();
    expect(mockAssertRequesterParticipation).not.toHaveBeenCalled();
  });

  // ── Test 6: AI service failure → 200 with fallback: true ────────────────────
  it('returns 200 with fallback:true flag when AI service is unavailable', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupParticipantMocks();

    const aiErr = new Error('Divorce indicator temporarily unavailable') as Error & {
      code: string;
      status: number;
    };
    aiErr.code = 'AI_SERVICE_UNAVAILABLE';
    aiErr.status = 503;
    mockGetDivorceProbability.mockRejectedValueOnce(aiErr);

    const res = await request(buildApp())
      .get(`/api/v1/ai/divorce-indicator/${MATCH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fallback).toBe(true);
    expect(res.body.data.level).toBe('MEDIUM');
    expect(typeof res.body.data.narrative).toBe('string');
    expect(typeof res.body.data.disclaimer).toBe('string');
  });

  // ── Test 7: rate limit — 6th request in a day returns 429 ───────────────────
  it('returns 429 with Retry-After header when user exceeds 5 requests per day', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    // Simulate count=6 (over the daily limit of 5)
    mockRedisIncr.mockResolvedValueOnce(6);

    const res = await request(buildApp())
      .get(`/api/v1/ai/divorce-indicator/${MATCH_ID}`);

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    // Retry-After header should be present
    expect(res.headers['retry-after']).toBeDefined();
    // AI service should NOT be called
    expect(mockGetDivorceProbability).not.toHaveBeenCalled();
  });

  // ── Test 8: response never includes the other user's profileId ──────────────
  it('never includes other profile ID in the DPI response (privacy assertion)', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupParticipantMocks();

    const res = await request(buildApp())
      .get(`/api/v1/ai/divorce-indicator/${MATCH_ID}`);

    expect(res.status).toBe(200);
    const responseStr = JSON.stringify(res.body);
    // OTHER_PROFILE_ID must NOT appear anywhere in the response body
    expect(responseStr).not.toContain(OTHER_PROFILE_ID);
    // requesterProfileId should also not leak as it's derivable from session
    expect(responseStr).not.toContain(MOCK_PROFILE_ID);
  });

  // ── Test 9: logging uses sanitized payload (no raw score/narrative) ──────────
  it('logs only sanitized payload — no raw score or narrative in logger call', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupParticipantMocks();

    await request(buildApp())
      .get(`/api/v1/ai/divorce-indicator/${MATCH_ID}`);

    expect(mockLoggerInfo).toHaveBeenCalled();
    // Extract the first argument (context object) from the log call
    const logContext = mockLoggerInfo.mock.calls[0]?.[0] as {
      dpi?: {
        requester_hash?: string;
        level?: string;
        computed_at?: string;
        score?: unknown;
        narrative?: unknown;
        top_factors?: unknown;
      };
    };
    expect(logContext?.dpi).toBeDefined();
    // Safe fields should be present
    expect(logContext?.dpi?.requester_hash).toBeDefined();
    expect(logContext?.dpi?.level).toBeDefined();
    expect(logContext?.dpi?.computed_at).toBeDefined();
    // Sensitive fields must NOT be present
    expect(logContext?.dpi?.score).toBeUndefined();
    expect(logContext?.dpi?.narrative).toBeUndefined();
    expect(logContext?.dpi?.top_factors).toBeUndefined();
  });
});

// ── Test 10: extractFeatures returns all 10 normalized values in [0, 1] ───────

describe('extractFeatures() — feature normalization', () => {
  it('returns all 10 features with values in the [0, 1] range for any input', async () => {
    // Use the REAL extractFeatures (not mocked) — import via vi.importActual to bypass mock
    const { extractFeatures: realExtractFeatures } =
      await vi.importActual<typeof import('../services/dpiFeatures.js')>(
        '../services/dpiFeatures.js',
      );

    const profileA: DpiProfile = {
      id:        MOCK_PROFILE_ID,
      userId:    MOCK_USER.id,
      latitude:  '18.5204',
      longitude: '73.8567',
      content: {
        personal:   { dob: new Date('1992-05-01'), religion: 'HINDU' },
        education:  { degree: 'B.Tech' },
        profession: { incomeRange: '10-15 LPA' },
        family:     { familyValues: 'MODERATE' },
        lifestyle: {
          diet:     'VEG',
          smoking:  'NEVER',
          drinking: 'NEVER',
          interests: ['travel', 'cooking', 'music'],
          hyperNicheTags: ['spiritual'],
        },
        horoscope:  { gunaScore: 28 },
        partnerPreferences: {
          ageRange:   { min: 24, max: 32 },
          religion:   ['HINDU'],
          diet:       ['VEG', 'JAIN'],
          education:  ['B.Tech', 'Masters'],
          openToInterfaith: false,
          openToInterCaste: true,
        },
        communityZone: 'Maratha',
      },
    };

    const profileB: DpiProfile = {
      id:        OTHER_PROFILE_ID,
      userId:    'user_other456',
      latitude:  '19.0760',
      longitude: '72.8777',
      content: {
        personal:   { dob: new Date('1994-09-15'), religion: 'HINDU' },
        education:  { degree: 'Masters' },
        profession: { incomeRange: '8-12 LPA' },
        family:     { familyValues: 'TRADITIONAL' },
        lifestyle: {
          diet:     'VEG',
          smoking:  'NEVER',
          drinking: 'OCCASIONALLY',
          interests: ['travel', 'cooking', 'photography'],
          hyperNicheTags: ['career-first'],
        },
        horoscope:  { gunaScore: 22 },
        partnerPreferences: {
          openToInterfaith: false,
          openToInterCaste: true,
        },
        communityZone: 'Maratha',
      },
    };

    // Use MATCH_ID — Redis will return null (no emotional score cached) → default 0.5
    const features = await realExtractFeatures(profileA, profileB, MATCH_ID);

    const featureKeys = [
      'age_gap_years',
      'education_gap',
      'income_disparity_pct',
      'family_values_alignment',
      'lifestyle_compatibility',
      'communication_score',
      'guna_milan_score',
      'geographic_distance_km',
      'religion_caste_match',
      'preference_match_pct',
    ] as const;

    // All 10 features must be present
    expect(Object.keys(features)).toHaveLength(10);

    // All values must be in [0, 1]
    for (const key of featureKeys) {
      const value = features[key];
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }

    // Spot checks based on known inputs
    // Age gap: ~2.4 years → band 0.0
    expect(features.age_gap_years).toBe(0);
    // Same religion, same community → 0.0
    expect(features.religion_caste_match).toBe(0);
    // Diet match (both VEG) → no diet mismatch contribution
    // Drinking mismatch NEVER vs OCCASIONALLY → small risk
    expect(features.lifestyle_compatibility).toBeGreaterThan(0);
    expect(features.lifestyle_compatibility).toBeLessThan(1);
  });
});
