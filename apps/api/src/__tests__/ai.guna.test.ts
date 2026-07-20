/**
 * Guna Milan (Ashtakoot) API tests
 *
 * Tests the GET /api/v1/ai/guna/:matchId endpoint for:
 * - Privacy enforcement (participant check, ACCEPTED status only)
 * - Rate limiting
 * - Cache behavior
 * - AI service integration
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
  mockCallAiService,
  mockAssertRequesterParticipation,
  mockLoggerInfo,
  mockProfileContentFindOne,
} = vi.hoisted(() => ({
  mockGetSession:                   vi.fn(),
  mockDbSelect:                     vi.fn(),
  mockResolveProfileId:             vi.fn(),
  mockRedisIncr:                    vi.fn().mockResolvedValue(1),
  mockRedisExpire:                  vi.fn().mockResolvedValue(1),
  mockRedisGet:                     vi.fn().mockResolvedValue(null),
  mockRedisSet:                     vi.fn().mockResolvedValue('OK'),
  mockCallAiService:                vi.fn(),
  mockAssertRequesterParticipation: vi.fn(),
  mockLoggerInfo:                   vi.fn(),
  mockProfileContentFindOne:        vi.fn(),
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
//
// The where-clause is decoded and passed to mockDbSelect as a plain string[]
// of the profile ids it filters on. That matters: an order-keyed mock
// (mockResolvedValueOnce chains) cannot tell WHICH profile a query asked for,
// so any test asserting on load ORDER passes even against code that loads the
// wrong profile first. This endpoint's whole correctness rests on load order
// -- Guna Milan is order-sensitive -- so the mock has to discriminate by input.
vi.mock('../lib/db.js', () => {
  // Walk drizzle's SQL object and pull out the bound parameter values. The
  // ids live in `queryChunks` as Param nodes; JSON.stringify does not reach
  // them, hence the manual walk.
  const clauseValues = (node: unknown, out: string[] = []): string[] => {
    if (!node || typeof node !== 'object') return out;
    const o = node as Record<string, unknown>;
    if (typeof o['value'] === 'string') out.push(o['value']);
    for (const key of ['queryChunks', 'value']) {
      const v = o[key];
      if (Array.isArray(v)) v.forEach((c) => clauseValues(c, out));
    }
    return out;
  };

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn((clause: unknown) => ({
            limit: (n: number) => mockDbSelect(clauseValues(clause), n),
          })),
        })),
      })),
    },
  };
});

vi.mock('../lib/profile.js', () => ({ resolveProfileId: mockResolveProfileId }));

vi.mock('../lib/redis.js', () => ({
  redis: {
    incr:   mockRedisIncr,
    expire: mockRedisExpire,
    get:    mockRedisGet,
    set:    mockRedisSet,
  },
}));

vi.mock('../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: {
    findOne: mockProfileContentFindOne,
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: mockLoggerInfo, error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock AI service
vi.mock('../lib/ai.js', () => ({
  callAiService: mockCallAiService,
}));

// Mock dpiPrivacy.ts
vi.mock('../services/dpiPrivacy.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/dpiPrivacy.js')>();
  return {
    ...original,
    assertRequesterParticipation: mockAssertRequesterParticipation,
  };
});

// ── Import modules after mocks ────────────────────────────────────────────

import { aiRouter } from '../routes/ai.js';
import { DpiPrivacyError } from '../services/dpiPrivacy.js';

// ── Test app factory ──────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/ai', aiRouter);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────

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

const MOCK_GUNA_RESPONSE = {
  total_score: 28,
  max_score: 36,
  percentage: 77.8,
  factors: {
    varna:        { score: 1, max: 1, compatible: true, name: 'Varna', name_hi: 'वर्ण', domain: 'caste', meaning: 'Compatible caste', status: 'good' },
    vashya:       { score: 2, max: 2, compatible: true, name: 'Vashya', name_hi: 'वश्य', domain: 'nature', meaning: 'Nature match', status: 'good' },
    tara:         { score: 3, max: 3, compatible: true, name: 'Tara', name_hi: 'तारा', domain: 'stars', meaning: 'Star position', status: 'good' },
    yoni:         { score: 4, max: 4, compatible: true, name: 'Yoni', name_hi: 'योनि', domain: 'biological', meaning: 'Biological', status: 'excellent' },
    graha_maitri: { score: 5, max: 5, compatible: true, name: 'Graha Maitri', name_hi: 'ग्रह मैत्री', domain: 'planets', meaning: 'Planet lords', status: 'excellent' },
    gana:         { score: 6, max: 6, compatible: true, name: 'Gana', name_hi: 'गण', domain: 'temperament', meaning: 'Same temperament', status: 'excellent' },
    bhakoot:      { score: 7, max: 7, compatible: true, name: 'Bhakoot', name_hi: 'भकूत', domain: 'rashi', meaning: 'Rashi compatibility', status: 'excellent' },
    nadi:         { score: 0, max: 8, compatible: false, name: 'Nadi', name_hi: 'नाड़ी', domain: 'genetic', meaning: 'Same nadi — dosha', status: 'low' },
  },
  doshas: {
    manglik:  { boy_status: 'NO', girl_status: 'NO', conflict: false, cancelled: false, severity: 'none', reason: 'No manglik on either side' },
    nadi:     { same_nadi: true, dosha: true, cancelled: false, severity: 'high', reason: 'Genetic incompatibility' },
    bhakoot:  { dosha: false, cancelled: false, severity: 'none', reason: 'No bhakoot dosha' },
    rajju:    { dosha: false, severity: 'none', reason: 'No rajju dosha' },
    vedha:    { dosha: false, severity: 'none', reason: 'No vedha dosha' },
    gana:     { dosha: false, cancelled: false, severity: 'none', reason: 'Gana compatible' },
  },
  yogas: {
    mahendra:      { present: false, count: null, reason: 'Not present' },
    stree_deergha: { present: false, count: null, reason: 'Not present' },
  },
  insights: {
    mental:     { score: 85, label: 'excellent', summary: 'Strong mental compatibility' },
    physical:   { score: 80, label: 'good', summary: 'Good physical health alignment' },
    prosperity: { score: 75, label: 'good', summary: 'Financial harmony' },
    progeny:    { score: 80, label: 'good', summary: 'Fertility indicators positive' },
    longevity:  { score: 85, label: 'excellent', summary: 'Relationship longevity likely' },
  },
  remedies: [],
  blocking_dosha: true,
  mangal_dosha_conflict: false,
  interpretation: 'Good match',
  recommendation: 'The high nadi dosha (genetic incompatibility) should be discussed with a Vedic astrologer for remedies.',
};

// ── DB mock helpers ───────────────────────────────────────────────────────────

/**
 * @param requesterGender gender of the profile making the request
 * @param otherGender     gender of the other participant
 *
 * The endpoint issues THREE db.select().limit() calls in order:
 *   1. the gender lookup that decides which profile is `profile_a`
 *   2. loadHoroscope(groom)  -> userId
 *   3. loadHoroscope(bride)  -> userId
 * The ordered mocks below must stay in that sequence — this helper exists so
 * that a change to the query order fails loudly in one place rather than
 * silently shifting every test's expectations.
 */
const OTHER_USER_ID = 'user_other456';

/** Horoscopes keyed by USER id, so a fixture follows its profile rather than
 *  the order it happened to be requested in. */
const HOROSCOPE_BY_USER: Record<string, { rashi: string; nakshatra: string; manglik: string }> = {
  [MOCK_USER.id]:  { rashi: 'Mesha',     nakshatra: 'Ashwini', manglik: 'NO' },
  [OTHER_USER_ID]: { rashi: 'Vrishabha', nakshatra: 'Bharani', manglik: 'NO' },
};

const USER_BY_PROFILE: Record<string, string> = {
  [MOCK_PROFILE_ID]:  MOCK_USER.id,
  [OTHER_PROFILE_ID]: OTHER_USER_ID,
};

/**
 * @param requesterGender gender of the profile making the request
 * @param otherGender     gender of the other participant
 *
 * Gender lives in MongoDB at `personal.gender`, in the SAME document as the
 * horoscope — there is no gender column on the Postgres profiles table. So
 * both come back from the ProfileContent mock together.
 *
 * Everything here is keyed by INPUT, never by call order: the db mock answers
 * on the profile id its where-clause actually named, and the content mock
 * answers on the userId it was queried with. An order-keyed mock cannot tell
 * WHICH profile was loaded first, so it would pass even against code that
 * loads the wrong one first — and load order is exactly what the groom/bride
 * ordering rule turns on.
 */
function setupParticipantMocks(
  requesterGender: 'MALE' | 'FEMALE' | null = 'MALE',
  otherGender: 'MALE' | 'FEMALE' | null = 'FEMALE',
) {
  const GENDER_BY_USER: Record<string, string | null> = {
    [MOCK_USER.id]:  requesterGender,
    [OTHER_USER_ID]: otherGender,
  };

  mockDbSelect.mockImplementation((ids: string[]) => {
    const profileId = ids.find((i) => i in USER_BY_PROFILE);
    if (profileId) return Promise.resolve([{ userId: USER_BY_PROFILE[profileId] }]);
    return Promise.resolve([]);
  });

  mockProfileContentFindOne.mockImplementation((q: { userId: string }) => ({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(
        HOROSCOPE_BY_USER[q.userId]
          ? {
              horoscope: HOROSCOPE_BY_USER[q.userId],
              personal:  { gender: GENDER_BY_USER[q.userId] ?? undefined },
            }
          : null,
      ),
    }),
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/ai/guna/:matchId', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockResolveProfileId.mockResolvedValue(MOCK_PROFILE_ID);
    mockCallAiService.mockResolvedValue(MOCK_GUNA_RESPONSE);
    mockAssertRequesterParticipation.mockResolvedValue({ otherProfileId: OTHER_PROFILE_ID });
  });

  // ── Test 1: 401 without session ─────────────────────────────────────────────
  it('returns 401 when no session cookie is present', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/guna/${MATCH_ID}`);

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
      .get(`/api/v1/ai/guna/${MATCH_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('DPI_PRIVACY_VIOLATION');
  });

  // ── Test 3: 404 for PENDING match (NOT 403 — existence leak prevention) ─────
  it('returns 404 for a PENDING/non-ACCEPTED match to prevent existence leaks', async () => {
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
      .get(`/api/v1/ai/guna/${MATCH_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('MATCH_NOT_FOUND');
    // CRITICAL: must NOT be 403 — that would leak existence of the match
    expect(res.status).not.toBe(403);
  });

  // ── Test 4: 200 with full GunaResult for valid request ──────────────────────
  it('returns 200 with full GunaResult when auth and match are valid', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    setupParticipantMocks();

    const res = await request(buildApp())
      .get(`/api/v1/ai/guna/${MATCH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(typeof data.totalScore).toBe('number');
    expect(data.totalScore).toBe(28);
    expect(typeof data.percentage).toBe('number');
    expect(data.interpretation).toBe('Good match');
    expect(typeof data.recommendation).toBe('string');
    expect(data.blockingDosha).toBe(true);
    expect(typeof data.factors).toBe('object');
    expect(typeof data.doshas).toBe('object');
    expect(Array.isArray(data.remedies)).toBe(true);
    expect(mockCallAiService).toHaveBeenCalledOnce();
  });

  // ── Test 5: Cache hit returns cached value ────────────────────────────────────
  it('returns cached Guna response without calling AI service when Redis has entry', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(MOCK_PROFILE_ID);
    // Redis cache hit
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(MOCK_GUNA_RESPONSE));

    const res = await request(buildApp())
      .get(`/api/v1/ai/guna/${MATCH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // AI service must NOT be called — cache served
    expect(mockCallAiService).not.toHaveBeenCalled();
    // Privacy check IS called (happens before cache check in the code)
    expect(mockAssertRequesterParticipation).toHaveBeenCalled();
  });

  // ── Test 6: 400 when horoscope data missing ──────────────────────────────────
  it('returns 400 when profile lacks horoscope data', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(MOCK_PROFILE_ID);
    mockAssertRequesterParticipation.mockResolvedValueOnce({ otherProfileId: OTHER_PROFILE_ID });

    // Start from the standard input-keyed mocks, then blank out ONE side's
    // content document so the incomplete-data branch is what gets exercised.
    setupParticipantMocks('MALE', 'FEMALE');
    mockProfileContentFindOne.mockImplementation((q: { userId: string }) => ({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(
          q.userId === MOCK_USER.id
            ? null  // requester has no horoscope on file
            : {
                horoscope: { rashi: 'Vrishabha', nakshatra: 'Bharani', manglik: 'NO' },
                personal:  { gender: 'FEMALE' },
              },
        ),
      }),
    }));

    const res = await request(buildApp())
      .get(`/api/v1/ai/guna/${MATCH_ID}`);

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('INCOMPLETE_DATA');
  });

  // ── Test 7: Invalid matchId format returns 400 ───────────────────────────────
  it('returns 400 when matchId is not a valid UUID', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });

    const res = await request(buildApp())
      .get('/api/v1/ai/guna/not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('VALIDATION_ERROR');
  });

  // ── Test 8: 404 when profile ID cannot be resolved ──────────────────────────
  it('returns 404 when userId cannot be resolved to profileId', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .get(`/api/v1/ai/guna/${MATCH_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('PROFILE_NOT_FOUND');
  });

  // ── Test 9: Transformation from snake_case Python to camelCase ─────────────
  it('correctly transforms Python snake_case response to TypeScript camelCase', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(MOCK_PROFILE_ID);
    mockAssertRequesterParticipation.mockResolvedValueOnce({ otherProfileId: OTHER_PROFILE_ID });
    setupParticipantMocks();

    const res = await request(buildApp())
      .get(`/api/v1/ai/guna/${MATCH_ID}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    // Check snake_case → camelCase transformations
    expect(data.totalScore).toBeDefined();
    expect(data.total_score).toBeUndefined();
    expect(data.maxScore).toBeDefined();
    expect(data.max_score).toBeUndefined();
    expect(data.blockingDosha).toBeDefined();
    expect(data.blocking_dosha).toBeUndefined();
    expect(data.factors.grahaMaitri).toBeDefined();
    expect(data.factors.graha_maitri).toBeUndefined();
  });

  // ── Test 10: Blocking dosha flag is preserved ────────────────────────────────
  it('preserves blockingDosha flag in response for high-severity doshas', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(MOCK_PROFILE_ID);
    mockAssertRequesterParticipation.mockResolvedValueOnce({ otherProfileId: OTHER_PROFILE_ID });
    setupParticipantMocks();

    const res = await request(buildApp())
      .get(`/api/v1/ai/guna/${MATCH_ID}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.blockingDosha).toBe(true);
    // Should include recommendation about remedies
    expect(data.recommendation).toContain('Vedic astrologer');
  });

  // ── Tests 11-12: groom is always profile_a, whoever is asking ───────────────
  //
  // Guna Milan is ORDER-SENSITIVE. Varna scores when the boy's rank >= the
  // girl's; Tara is counted girl -> boy. If the requester were passed as
  // `profile_a`, the two people in a single match would get two different
  // scores for the same pairing — and since the cache key is normalised over
  // the profile-id pair, whichever of them loaded the page first would decide
  // what the other one saw. These two tests are the regression guard: the
  // payload sent to the AI service must be IDENTICAL regardless of who asks.

  it('sends the groom as profile_a when the MALE participant is the requester', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(MOCK_PROFILE_ID);
    mockAssertRequesterParticipation.mockResolvedValueOnce({ otherProfileId: OTHER_PROFILE_ID });
    // Requester is MALE -> requester is the groom -> loaded first.
    setupParticipantMocks('MALE', 'FEMALE');

    const res = await request(buildApp()).get(`/api/v1/ai/guna/${MATCH_ID}`);
    expect(res.status).toBe(200);

    const payload = mockCallAiService.mock.calls[0]?.[1] as {
      profile_a: { rashi: string }; profile_b: { rashi: string };
    };
    // Mesha/Ashwini is the first horoscope fixture, i.e. the groom's.
    expect(payload.profile_a.rashi).toBe('Mesha');
    expect(payload.profile_b.rashi).toBe('Vrishabha');
  });

  it('still sends the groom as profile_a when the FEMALE participant is the requester', async () => {
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(MOCK_PROFILE_ID);
    mockAssertRequesterParticipation.mockResolvedValueOnce({ otherProfileId: OTHER_PROFILE_ID });
    // Requester is FEMALE, so the OTHER participant is the groom and must be
    // sent as profile_a. The requester owns the Mesha horoscope, so a correct
    // implementation SWAPS them: profile_a is Vrishabha here, not Mesha.
    // This is the assertion that fails if the requester is passed as
    // profile_a -- i.e. the actual regression guard.
    setupParticipantMocks('FEMALE', 'MALE');

    const res = await request(buildApp()).get(`/api/v1/ai/guna/${MATCH_ID}`);
    expect(res.status).toBe(200);

    const payload = mockCallAiService.mock.calls[0]?.[1] as {
      profile_a: { rashi: string }; profile_b: { rashi: string };
    };
    expect(payload.profile_a.rashi).toBe('Vrishabha');  // the groom
    expect(payload.profile_b.rashi).toBe('Mesha');      // the bride (requester)
  });

  it('falls back to a stable order when the pair is not one MALE and one FEMALE', async () => {
    // No groom/bride ordering is defined here (missing gender, NON_BINARY,
    // OTHER, same-gender). The rule cannot be applied, but the result must
    // still be STABLE so both parties see the same thing and the shared cache
    // entry stays coherent. Sorting by profile id gives that.
    mockGetSession.mockResolvedValueOnce({ user: MOCK_USER, session: {} });
    mockResolveProfileId.mockResolvedValueOnce(MOCK_PROFILE_ID);
    mockAssertRequesterParticipation.mockResolvedValueOnce({ otherProfileId: OTHER_PROFILE_ID });
    setupParticipantMocks(null, null);

    const res = await request(buildApp()).get(`/api/v1/ai/guna/${MATCH_ID}`);
    expect(res.status).toBe(200);

    // MOCK_PROFILE_ID (...0001) sorts before OTHER_PROFILE_ID (...0002), so
    // the requester's horoscope is loaded first here.
    const payload = mockCallAiService.mock.calls[0]?.[1] as {
      profile_a: { rashi: string }; profile_b: { rashi: string };
    };
    expect(payload.profile_a.rashi).toBe('Mesha');
    expect(payload.profile_b.rashi).toBe('Vrishabha');
  });
});
