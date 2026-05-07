/**
 * FII (Family Inclination Index) API tests
 *
 * Tests:
 *   GET /api/v1/ai/fii/score/:profileId
 *   GET /api/v1/ai/fii/compatibility/:matchId
 *   extractFiiSignals + encodeFamilySignals graceful null-handling
 *
 * All external dependencies mocked so tests run without live infrastructure.
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
  mockGetFiiCompatibility,
  mockExtractFiiSignals,
} = vi.hoisted(() => ({
  mockGetSession:         vi.fn(),
  mockDbSelect:           vi.fn(),
  mockResolveProfileId:   vi.fn(),
  mockRedisIncr:          vi.fn().mockResolvedValue(1),
  mockRedisExpire:        vi.fn().mockResolvedValue(1),
  mockRedisGet:           vi.fn().mockResolvedValue(null),
  mockRedisSet:           vi.fn().mockResolvedValue('OK'),
  mockGetFiiCompatibility: vi.fn(),
  mockExtractFiiSignals:  vi.fn(),
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

// DB mock — chainable .from().where().limit() and .from().where().where().limit()
vi.mock('../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockDbSelect,
          where: vi.fn(() => ({
            limit: mockDbSelect,
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
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
    ttl:    vi.fn().mockResolvedValue(0),
    zadd:            vi.fn().mockResolvedValue(1),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zrange:          vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: {
    findOne: vi.fn(() => ({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
    })),
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock aiService — add getFiiCompatibility
vi.mock('../services/aiService.js', () => ({
  getConversationSuggestions: vi.fn(),
  getEmotionalScore:          vi.fn(),
  getDivorceProbability:      vi.fn(),
  getFiiCompatibility:        mockGetFiiCompatibility,
}));

// Mock fiiScore — extractFiiSignals
vi.mock('../services/fiiScore.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/fiiScore.js')>();
  return {
    ...original, // keep encodeFamilySignals, computeFiiScoreFromSignals real
    extractFiiSignals: mockExtractFiiSignals,
  };
});

// Also mock dpiPrivacy / dpiFeatures so existing coach/dpi routes still mount
vi.mock('../services/dpiPrivacy.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/dpiPrivacy.js')>();
  return { ...original };
});

vi.mock('../services/dpiFeatures.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/dpiFeatures.js')>();
  return { ...original };
});

vi.mock('../infrastructure/mongo/models/Chat.js', () => ({
  Chat: {
    findOne: vi.fn(() => ({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
    })),
  },
}));

// ── Import modules after mocks ────────────────────────────────────────────────

import { aiRouter } from '../routes/ai.js';
import { encodeFamilySignals, computeFiiScoreFromSignals } from '../services/fiiScore.js';
import type { FamilySection } from '@smartshaadi/types';

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

const PROFILE_ID       = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_PROFILE_ID = '550e8400-e29b-41d4-a716-446655440002';
const MATCH_ID         = '550e8400-e29b-41d4-a716-446655440003';

const MOCK_SIGNALS = {
  family_type_preference:    100,
  family_values_orientation:  60,
  parents_living_intent:     100,
  family_decisions:           75,
  cultural_events:            70,
  siblings_engagement:        50,
  religious_practice:         75,
};

const MOCK_FII_COMPAT_RESPONSE = {
  compatibility_score: 82,
  label:               'High Family Alignment',
  narrative:           'Both profiles show strong family-centric values.',
  breakdown:           MOCK_SIGNALS,
  computed_at:         '2026-05-07T10:00:00.000Z',
  use_llm_narrative:   false,
};

// ── GET /api/v1/ai/fii/score/:profileId tests ─────────────────────────────────

describe('GET /api/v1/ai/fii/score/:profileId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockExtractFiiSignals.mockResolvedValue(MOCK_SIGNALS);
  });

  // Test 1
  it('score_unauth_returns_401: returns 401 when no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/fii/score/${PROFILE_ID}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // Test 2
  it('score_returns_200_with_shape: returns score, label, breakdown on valid auth', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    // Profile lookup
    mockDbSelect.mockResolvedValueOnce([{
      id:                    PROFILE_ID,
      userId:                MOCK_USER.id,
      familyInclinationScore: 78,
    }]);

    const res = await request(buildApp())
      .get(`/api/v1/ai/fii/score/${PROFILE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.score).toBe('number');
    expect(typeof res.body.data.label).toBe('string');
    expect(res.body.data.breakdown).toBeDefined();
    expect(mockExtractFiiSignals).toHaveBeenCalledOnce();
  });

  // Test 3
  it('score_returns_cached_value_on_hit: returns cached value without hitting Mongo', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    // Profile lookup (needed before cache check in current route flow)
    mockDbSelect.mockResolvedValueOnce([{
      id:                    PROFILE_ID,
      userId:                MOCK_USER.id,
      familyInclinationScore: 78,
    }]);
    // Cache hit
    mockRedisGet.mockResolvedValueOnce(JSON.stringify({ score: 78, label: 'High Family Inclination', breakdown: MOCK_SIGNALS }));

    const res = await request(buildApp())
      .get(`/api/v1/ai/fii/score/${PROFILE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBe(78);
    // extractFiiSignals should NOT be called when cache hits
    expect(mockExtractFiiSignals).not.toHaveBeenCalled();
  });
});

// ── GET /api/v1/ai/fii/compatibility/:matchId tests ───────────────────────────

describe('GET /api/v1/ai/fii/compatibility/:matchId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockResolveProfileId.mockResolvedValue(PROFILE_ID);
    mockExtractFiiSignals.mockResolvedValue(MOCK_SIGNALS);
    mockGetFiiCompatibility.mockResolvedValue(MOCK_FII_COMPAT_RESPONSE);
  });

  // Test 4
  it('compatibility_unauth_returns_401: returns 401 when no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/fii/compatibility/${MATCH_ID}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // Test 5
  it('compatibility_non_participant_returns_403: returns 403 when user is not a match participant', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    // Match query returns empty (not a participant)
    mockDbSelect.mockResolvedValueOnce([]);

    const res = await request(buildApp())
      .get(`/api/v1/ai/fii/compatibility/${MATCH_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('MATCH_NOT_FOUND');
  });

  // Test 6
  it('compatibility_detailed_param_triggers_sonnet_path: detailed=true passes useLlmNarrative=true', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    // Match row
    mockDbSelect.mockResolvedValueOnce([{
      id:         MATCH_ID,
      senderId:   PROFILE_ID,
      receiverId: OTHER_PROFILE_ID,
      status:     'ACCEPTED',
    }]);
    // pgA userId
    mockDbSelect.mockResolvedValueOnce([{ userId: MOCK_USER.id }]);
    // pgB userId
    mockDbSelect.mockResolvedValueOnce([{ userId: 'user_other456' }]);

    const detailedResponse = { ...MOCK_FII_COMPAT_RESPONSE, use_llm_narrative: true };
    mockGetFiiCompatibility.mockResolvedValueOnce(detailedResponse);

    const res = await request(buildApp())
      .get(`/api/v1/ai/fii/compatibility/${MATCH_ID}?detailed=true`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // getFiiCompatibility called with useLlmNarrative=true
    expect(mockGetFiiCompatibility).toHaveBeenCalledWith(
      MOCK_SIGNALS,
      MOCK_SIGNALS,
      'Profile A',
      'Profile B',
      true, // <-- detailed=true path
    );
  });

  // Test 7
  it('compatibility_default_uses_template_path: no detailed param → useLlmNarrative=false', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    // Match row
    mockDbSelect.mockResolvedValueOnce([{
      id:         MATCH_ID,
      senderId:   PROFILE_ID,
      receiverId: OTHER_PROFILE_ID,
      status:     'ACCEPTED',
    }]);
    // pgA userId
    mockDbSelect.mockResolvedValueOnce([{ userId: MOCK_USER.id }]);
    // pgB userId
    mockDbSelect.mockResolvedValueOnce([{ userId: 'user_other456' }]);

    const res = await request(buildApp())
      .get(`/api/v1/ai/fii/compatibility/${MATCH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // getFiiCompatibility called with useLlmNarrative=false
    expect(mockGetFiiCompatibility).toHaveBeenCalledWith(
      MOCK_SIGNALS,
      MOCK_SIGNALS,
      'Profile A',
      'Profile B',
      false, // <-- template path
    );
  });
});

// ── encodeFamilySignals + computeFiiScoreFromSignals unit tests ───────────────

describe('extractFiiSignals_handles_missing_fields_gracefully', () => {
  // Test 8
  it('null/missing fields contribute 0 to weighted sum (NOT 50)', () => {
    // Empty section — all fields null/missing
    const signals = encodeFamilySignals(null);

    // All signals should be 0
    expect(signals.family_type_preference).toBe(0);
    expect(signals.family_values_orientation).toBe(0);
    expect(signals.parents_living_intent).toBe(0);
    expect(signals.family_decisions).toBe(0);
    expect(signals.cultural_events).toBe(0);
    expect(signals.siblings_engagement).toBe(0);
    expect(signals.religious_practice).toBe(0);

    // Score of all-zero signals must be 0
    const score = computeFiiScoreFromSignals(signals);
    expect(score).toBe(0);
  });

  it('fully filled JOINT/TRADITIONAL profile scores near 100', () => {
    const section: FamilySection = {
      familyType:                    'JOINT',
      familyValues:                  'TRADITIONAL',
      parentsLivingSituation:        'YES_COMMITTED',
      familyDecisionInvolvement:     'HIGH_COLLABORATIVE',
      culturalEventsAttendance:      'ALWAYS',
      siblings:                      [{ name: 'Priya' }, { name: 'Raj' }, { name: 'Anita' }],
      religiousObservanceWithFamily: 'VERY_ACTIVE_TOGETHER',
    };

    const signals = encodeFamilySignals(section);
    expect(signals.family_type_preference).toBe(100);
    expect(signals.family_values_orientation).toBe(100);
    expect(signals.parents_living_intent).toBe(100);
    expect(signals.family_decisions).toBe(100);
    expect(signals.cultural_events).toBe(100);
    expect(signals.siblings_engagement).toBe(90); // 3+ siblings
    expect(signals.religious_practice).toBe(100);

    const score = computeFiiScoreFromSignals(signals);
    // 100 * (0.20+0.15+0.18+0.15+0.12+0.13) + 90*0.07 = 100*0.93 + 90*0.07 = 93 + 6.3 = 99.3 → 99
    expect(score).toBeGreaterThanOrEqual(96);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('NUCLEAR/LIBERAL/INDEPENDENT profile scores lower end', () => {
    const section: FamilySection = {
      familyType:                    'NUCLEAR',
      familyValues:                  'LIBERAL',
      parentsLivingSituation:        'PREFER_SEPARATE',
      familyDecisionInvolvement:     'INDEPENDENT',
      culturalEventsAttendance:      'RARELY',
      siblings:                      [],            // 0 siblings → 20
      religiousObservanceWithFamily: 'NOT_PRACTICING',
    };

    const signals = encodeFamilySignals(section);
    expect(signals.family_type_preference).toBe(30);
    expect(signals.family_values_orientation).toBe(20);
    expect(signals.parents_living_intent).toBe(20);
    expect(signals.family_decisions).toBe(10);
    expect(signals.cultural_events).toBe(15);
    expect(signals.siblings_engagement).toBe(20);
    expect(signals.religious_practice).toBe(10);

    const score = computeFiiScoreFromSignals(signals);
    expect(score).toBeGreaterThanOrEqual(10);
    expect(score).toBeLessThanOrEqual(30);
  });
});
