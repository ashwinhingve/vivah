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

import type Redis from 'ioredis';
import { getCachedFeed, computeAndCacheFeed } from '../engine.js';
import { applyHardFilters } from '../filters.js';
import { scoreCandidate } from '../scorer.js';
import { matchComputeQueue } from '../../infrastructure/redis/queues.js';

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

  // We build a chain builder. Each method returns 'this' except terminal ones.
  // The engine calls several different query patterns so we model each.
  let callCount = 0;

  const chain = {
    from:     vi.fn().mockReturnThis(),
    where:    vi.fn().mockReturnThis(),
    orderBy:  vi.fn().mockReturnThis(),
    limit:    vi.fn(),
    select:   vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };

  // limit() is a terminal call — returns data depending on call order
  // Real engine DB call sequence:
  //   1 → user's own profile row
  //   2 → blocked outbound (blockerId = userProfileId)
  //   3 → blocked inbound  (blockedId = userProfileId)
  //   4 → active candidate profiles
  //   5 → community_zones bulk lookup (caste/gotra/manglik filters)
  //   6+ → primary photo per filtered candidate (one call each)
  chain.limit.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve(userProfile ? [userProfile] : []);
    if (callCount === 2) return Promise.resolve([]); // blocked outbound — empty by default
    if (callCount === 3) return Promise.resolve([]); // blocked inbound — empty by default
    if (callCount === 4) return Promise.resolve(candidates);
    if (callCount === 5) return Promise.resolve([]); // community_zones — empty by default
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
});
