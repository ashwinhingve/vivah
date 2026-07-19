import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/db.js', () => ({ db: {} }));

vi.mock('@smartshaadi/db', () => ({
  profiles:          { id: {}, userId: {}, isActive: {} },
  blockedUsers:      { blockerId: {}, blockedId: {} },
  profilePhotos:     { profileId: {}, isPrimary: {} },
  safetyModeUnlocks: { profileId: {}, unlockedFor: {} },
  shortlists:        { profileId: {}, targetProfileId: {} },
  communityZones:    { profileId: {}, community: {}, subCommunity: {}, caste: {}, gotra: {}, motherTongue: {}, gotraExclusionEnabled: {} },
  userBehaviorSummary: {
    userId: {}, day: {}, profileViewCount: {}, browseQueryCount: {},
    messageCount: {}, hourlyActivityHist: {},
  },
}));

vi.mock('../behaviourFeatures.js', () => ({
  getBehaviourRollup: vi.fn().mockResolvedValue(new Map()),
  isColdStart: () => true,
}));

// Mock the scorer so we get deterministic scores in engine tests
vi.mock('../../infrastructure/redis/queues.js', () => ({
  matchComputeQueue: { addBulk: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../scorer.js', () => ({
  scoreCandidate: vi.fn().mockResolvedValue({
    totalScore: 72,
    breakdown: {
      demographicAlignment:   { score: 18, max: 20 },
      lifestyleCompatibility: { score: 14, max: 15 },
      careerEducation:        { score: 12, max: 15 },
      familyValues:           { score: 13, max: 15 },
      preferenceOverlap:      { score: 10, max: 20 },
      personalityFit:         { score: 11, max: 15 },
    },
    gunaScore: 25,
    tier: 'good',
    flags: [],
  }),
}));

// Mock filters so we can control which candidates survive
vi.mock('../filters.js', () => ({
  applyHardFilters: vi.fn().mockImplementation(
    (_user: unknown, candidates: unknown[]) => candidates,
  ),
}));

// Mock mockStore so tests can inject per-userId content (safetyMode, etc.)
// This runs under USE_MOCK_SERVICES=true — the actual test env.
const mockStoreGet = vi.fn<(uid: string) => Record<string, unknown> | null>();
vi.mock('../../lib/mockStore.js', () => ({
  mockGet: (uid: string) => mockStoreGet(uid),
  mockUpsertField: vi.fn(),
}));

// Mock the Mongoose ProfileContent model. The engine has two ProfileContent.findOne
// paths (loadContentForUser and the feed-enrichment block) that are gated by
// `shouldUseMockMongo` from env.js. Because vi.mock hoisting can race with
// env.js's module-load-time evaluation of process.env, that gate sometimes
// resolves false in this test even though setupFiles set USE_MOCK_SERVICES=true.
// To keep tests independent of env-load ordering, route the model's findOne
// through the same mockStoreGet stub used for the mockStore path. Both code
// paths then read from one source of truth, so test assertions hold whichever
// branch the gate resolves to.
vi.mock('../../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: {
    findOne: vi.fn((filter: { userId?: string } = {}) => ({
      lean: () => Promise.resolve(filter.userId ? mockStoreGet(filter.userId) : null),
    })),
    // Batched read path. Routes each $in userId through the SAME mockStoreGet stub
    // so both the mock-mode and live-mode branches read one source of truth.
    find: vi.fn((filter: { userId?: { $in?: string[] } } = {}) => ({
      lean: () => {
        const ids = filter.userId?.$in ?? [];
        const docs = ids
          .map((uid) => {
            const d = mockStoreGet(uid);
            return d ? { ...d, userId: uid } : null;
          })
          .filter((d): d is Record<string, unknown> & { userId: string } => d !== null);
        return Promise.resolve(docs);
      },
    })),
  },
}));

import type Redis from 'ioredis';
import { getCachedFeed, computeAndCacheFeed, enrichRowWithDoc } from '../engine.js';
import { applyHardFilters } from '../filters.js';
import { scoreCandidate } from '../scorer.js';
import { matchComputeQueue } from '../../infrastructure/redis/queues.js';
import { ProfileContent } from '../../infrastructure/mongo/models/ProfileContent.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRedis(cached: string | null): Redis {
  return {
    get:    vi.fn().mockResolvedValue(cached),
    setex:  vi.fn().mockResolvedValue('OK'),
  } as unknown as Redis;
}

const USER_ID      = 'user-uuid-1';
const PROFILE_ID   = 'profile-uuid-1';
const CAND_PROF_ID = 'profile-uuid-2';

/** Minimal Drizzle-like db mock */
function makeDb(options: {
  userProfile?: Record<string, unknown>
  candidates?: Record<string, unknown>[]
  blockedIds?: string[]
  primaryPhoto?: Record<string, unknown> | null
} = {}): unknown {
  const {
    userProfile = { id: PROFILE_ID, userId: USER_ID, isActive: true },
    candidates  = [
      {
        id:           CAND_PROF_ID,
        userId:       'user-uuid-2',
        isActive:     true,
        personal:     { fullName: 'Test Candidate', dob: new Date('1995-01-01') },
        location:     { city: 'Mumbai', state: 'Maharashtra' },
        profession:   { incomeRange: '5-10 LPA' },
        education:    { degree: 'bachelors' },
        lifestyle:    { diet: 'VEG', smoking: 'NEVER', drinking: 'NEVER' },
        family:       { familyType: 'JOINT', familyValues: 'TRADITIONAL' },
        partnerPreferences: {
          ageRange: { min: 25, max: 35 },
          religion: ['Hindu'],
          openToInterfaith: false,
          incomeRange: '5-10 LPA',
          education: ['bachelors'],
          diet: ['VEG'],
          familyType: ['JOINT'],
        },
      },
    ],
    primaryPhoto    = null,
  } = options;

  const { blockedIds = [] } = options;

  // We build a chain builder. Each method returns 'this' except terminal ones.
  // The engine calls several different query patterns so we model each.
  let callCount = 0;

  const chain: Record<string, unknown> = {
    from:     vi.fn().mockReturnThis(),
    where:    vi.fn().mockReturnThis(),
    orderBy:  vi.fn().mockReturnThis(),
    limit:    vi.fn(),
    select:   vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };

  // The two blocked-user queries terminate at .where() (no .limit cap) — when
  // the chain itself is awaited it resolves to the blocked rows. Both outbound
  // (blockerId) and inbound (blockedId) read the same injected set; the engine
  // picks blockedId / blockerId off each row.
  chain['then'] = (resolve: (v: unknown[]) => unknown) =>
    Promise.resolve(resolve(blockedIds.map((id) => ({ blockedId: id, blockerId: id }))));

  // limit() is a terminal call — returns data depending on call order.
  // Real engine DB call sequence (blocked queries no longer hit limit):
  //   1 → user's own profile row
  //   2 → active candidate profiles
  //   3 → community_zones bulk lookup (caste/gotra/manglik filters)
  //   4+ → primary photo per filtered candidate (one call each)
  (chain['limit'] as ReturnType<typeof vi.fn>).mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve(userProfile ? [userProfile] : []);
    if (callCount === 2) return Promise.resolve(candidates);
    if (callCount === 3) return Promise.resolve([]); // community_zones — empty by default
    return Promise.resolve(primaryPhoto ? [primaryPhoto] : []);
  });

  return {
    select: vi.fn().mockReturnValue(chain),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getCachedFeed', () => {
  it('returns null on cache miss', async () => {
    const redis = makeRedis(null);
    const result = await getCachedFeed(USER_ID, redis);
    expect(result).toBeNull();
    expect(redis.get).toHaveBeenCalledWith(`match_feed:${USER_ID}`);
  });

  it('returns parsed feed array on cache hit', async () => {
    const cached = JSON.stringify([
      { profileId: CAND_PROF_ID, name: 'Test', age: 28, city: 'Mumbai',
        compatibility: { totalScore: 72, breakdown: {}, gunaScore: 25, tier: 'good', flags: [] },
        photoKey: null, isNew: false },
    ]);
    const redis = makeRedis(cached);
    const result = await getCachedFeed(USER_ID, redis);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

describe('computeAndCacheFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default filter mock after clearAllMocks
    vi.mocked(applyHardFilters).mockImplementation(
      (_user: unknown, candidates: unknown[]) => candidates as ReturnType<typeof applyHardFilters>,
    );
  });

  it('queries DB, caches result, and returns sorted feed on cache miss', async () => {
    const redis = makeRedis(null);
    const db    = makeDb();

    const result = await computeAndCacheFeed(USER_ID, db as never, redis);

    expect(Array.isArray(result)).toBe(true);
    expect(redis.setex).toHaveBeenCalledWith(
      `match_feed:${USER_ID}`,
      86400,
      expect.any(String),
    );
  });

  it('returns empty array when all candidates are filtered out', async () => {
    vi.mocked(applyHardFilters).mockReturnValue([]);
    const redis = makeRedis(null);
    const db    = makeDb();

    const result = await computeAndCacheFeed(USER_ID, db as never, redis);

    expect(result).toHaveLength(0);
    // Still caches the empty result
    expect(redis.setex).toHaveBeenCalled();
  });

  it('excludes blocked users from candidates', async () => {
    // The engine should filter blocked users at query level — we verify
    // that when candidates list is empty the engine handles it gracefully.
    const redis = makeRedis(null);
    const db    = makeDb({ candidates: [] });

    const result = await computeAndCacheFeed(USER_ID, db as never, redis);
    expect(result).toHaveLength(0);
  });

  it('excludes a blocked candidate even past the old 1000-row cap', async () => {
    // 1500 blocked ids with the candidate buried at index 1200 — the previous
    // .limit(1000) would have dropped it and leaked the candidate into the feed.
    const blockedIds = Array.from({ length: 1500 }, (_, i) => `blocked-${i}`);
    blockedIds[1200] = CAND_PROF_ID;
    const redis = makeRedis(null);
    const db    = makeDb({ blockedIds });

    const result = await computeAndCacheFeed(USER_ID, db as never, redis);
    expect(result).toHaveLength(0);
  });

  it('enqueues a Bull job for each guna_pending pair', async () => {
    vi.mocked(scoreCandidate).mockResolvedValueOnce({
      totalScore: 72,
      breakdown: {
        demographicAlignment:   { score: 18, max: 20 },
        lifestyleCompatibility: { score: 14, max: 15 },
        careerEducation:        { score: 12, max: 15 },
        familyValues:           { score: 13, max: 15 },
        preferenceOverlap:      { score: 10, max: 20 },
        personalityFit:         { score: 11, max: 15 },
      },
      gunaScore: 18,
      tier: 'good',
      flags: ['guna_pending'],
    });

    const redis = makeRedis(null);
    await computeAndCacheFeed(USER_ID, makeDb() as never, redis);

    expect(matchComputeQueue.addBulk).toHaveBeenCalledOnce();

    const jobs = vi.mocked(matchComputeQueue.addBulk).mock.calls[0]![0];
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.name).toBe('guna-recalc');

    const { profileAId, profileBId } = jobs[0]!.data;
    expect(typeof profileAId).toBe('string');
    expect(typeof profileBId).toBe('string');
    // IDs must be sorted alphabetically
    expect(profileAId <= profileBId).toBe(true);
  });

  it('excludes candidates with safetyMode.incognito = true', async () => {
    mockStoreGet.mockImplementation((uid: string) =>
      uid === 'user-uuid-2' ? { safetyMode: { incognito: true } } : null,
    );
    const redis = makeRedis(null);
    const result = await computeAndCacheFeed(USER_ID, makeDb() as never, redis);
    expect(result).toEqual([]);
    mockStoreGet.mockReset();
  });

  it('populates isVerified, photoHidden, and shortlisted on every feed item', async () => {
    mockStoreGet.mockReturnValue(null);
    const redis = makeRedis(null);
    const result = await computeAndCacheFeed(USER_ID, makeDb() as never, redis);
    expect(result).toHaveLength(1);
    const item = result[0]!;
    expect(item.isVerified).toBe(true);
    expect(typeof item.photoHidden).toBe('boolean');
    expect(typeof item.shortlisted).toBe('boolean');
    mockStoreGet.mockReset();
  });

  // Regression guard for the N+1 batched-read refactor: the same candidate set,
  // names and scores must come through, while content is read ONCE per user
  // instead of the old 2N+F per-candidate findOne loop.
  it('batched read yields the same candidate set + scores, with no per-candidate N+1', async () => {
    const candidates = [
      { id: 'p-2', userId: 'u-2', isActive: true },
      { id: 'p-3', userId: 'u-3', isActive: true },
      { id: 'p-4', userId: 'u-4', isActive: true },
    ];
    const content: Record<string, Record<string, unknown>> = {
      'u-2': { personal: { fullName: 'Asha',   dob: new Date('1995-01-01') }, location: { city: 'Pune'   } },
      'u-3': { personal: { fullName: 'Bina',   dob: new Date('1993-06-15') }, location: { city: 'Delhi'  } },
      'u-4': { personal: { fullName: 'Chitra', dob: new Date('1996-03-20') }, location: { city: 'Mumbai' } },
    };
    mockStoreGet.mockImplementation((uid: string) => content[uid] ?? null);

    const redis = makeRedis(null);
    const result = await computeAndCacheFeed(USER_ID, makeDb({ candidates }) as never, redis);

    // Same candidate set …
    expect(result.map((r) => r.profileId).sort()).toEqual(['p-2', 'p-3', 'p-4']);
    // … same names enriched from the batched map …
    expect(new Set(result.map((r) => r.name))).toEqual(new Set(['Asha', 'Bina', 'Chitra']));
    // … same cities …
    expect(new Set(result.map((r) => r.city))).toEqual(new Set(['Pune', 'Delhi', 'Mumbai']));
    // … same (mocked) scores — ranking unchanged.
    for (const item of result) expect(item.compatibility.totalScore).toBe(72);

    // N+1 killed: content is read once per user (3 candidates + 1 viewer = 4),
    // deterministic across the mock/live gate since both route through mockStoreGet.
    // Old path was 2N + F + 1 = 10.
    expect(mockStoreGet).toHaveBeenCalledTimes(candidates.length + 1);
    // The per-candidate findOne loop is gone — at most the single viewer read
    // (only in the live-gate branch; zero in the mock branch).
    const findOneMock = (ProfileContent as unknown as { findOne: ReturnType<typeof vi.fn> }).findOne;
    expect(findOneMock.mock.calls.length).toBeLessThanOrEqual(1);

    mockStoreGet.mockReset();
  });
});

// ── enrichRowWithDoc column preservation (regression, Unit 7.2) ──────────────
//
// enrichRowWithDoc does NOT mutate the row it is given: it builds a fresh object
// from {id, userId, isActive} and copies an explicit whitelist of fields. Any
// Postgres column missing from that whitelist is silently dropped for every
// profile that has a Mongo content doc — i.e. every real user.
//
// That is exactly what happened to the Sprint G NRI columns. They were added to
// ProfileRow and read in rowToProfileData, but never copied here, so
// countryOfResidence/openToNriMatching reached the filter as undefined. Both
// isCrossBorder() and hasOptedIntoNri() then returned false and the
// NRI_MATCHING_LIVE bypass could not fire in the real feed for anyone.
//
// The filters.test.ts suite could not catch this: it builds ProfileWithPreferences
// objects directly and never traverses this mapper. The bug lived in the seam
// between two well-tested units.

describe('enrichRowWithDoc preserves Postgres-only columns (Unit 7.2 regression)', () => {
  const row = {
    id: 'p1', userId: 'u1', isActive: true,
    latitude: 19.076, longitude: 72.8777,
    countryOfResidence: 'US',
    openToNriMatching: true,
    ianaTimezone: 'America/New_York',
    personal: { fullName: 'From PG' },
  };

  it('carries the NRI columns through when a Mongo doc is present', () => {
    // A doc that overrides `personal` — the branch that rebuilds the object and
    // therefore the branch where a missing whitelist entry loses data.
    const out = enrichRowWithDoc(row, { personal: { fullName: 'From Mongo' } } as never);

    expect(out.countryOfResidence).toBe('US');
    expect(out.openToNriMatching).toBe(true);
    expect(out.ianaTimezone).toBe('America/New_York');
    // Sanity: the doc really did take effect, so we are on the rebuild branch
    // and not accidentally asserting against the early `if (!doc) return row`.
    expect(out.personal?.fullName).toBe('From Mongo');
    // Guard the neighbouring columns that share this failure mode.
    expect(out.latitude).toBe(19.076);
    expect(out.longitude).toBe(72.8777);
  });

  it('leaves the columns untouched when there is no doc', () => {
    const out = enrichRowWithDoc(row, null);
    expect(out.countryOfResidence).toBe('US');
    expect(out.openToNriMatching).toBe(true);
  });

  it('does not invent values for a row that never had them', () => {
    const bare = { id: 'p2', userId: 'u2', isActive: true };
    const out = enrichRowWithDoc(bare, { personal: { fullName: 'x' } } as never);
    expect(out.countryOfResidence).toBeUndefined();
    expect(out.openToNriMatching).toBeUndefined();
  });
});
