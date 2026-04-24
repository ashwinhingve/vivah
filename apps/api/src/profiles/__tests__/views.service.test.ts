/**
 * Smart Shaadi — Profile Views Service Tests
 * apps/api/src/profiles/__tests__/views.service.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

// Flexible chainable query builder mock — supports arbitrary depth of chaining
// by returning a proxy that always returns itself for unknown methods, and
// resolves to `mockResolveValue` when `.limit()` or awaited.
let mockQueryResult: unknown[] = [];

function makeChain(): Record<string, unknown> {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  const methods = ['from', 'where', 'leftJoin', 'orderBy', 'limit'];
  for (const m of methods) {
    chain[m] = (..._args: unknown[]) => {
      if (m === 'limit') {
        // limit() is the terminal call — return the promise
        return Promise.resolve(mockQueryResult);
      }
      return makeChain();
    };
  }
  // Make the chain itself thenable so `await chain` works if needed
  chain['then'] = undefined as unknown as (...args: unknown[]) => unknown;
  return chain;
}

const mockSelect = vi.fn(() => makeChain());
const mockInsertValues = vi.fn().mockResolvedValue([]);
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock('../../lib/db.js', () => ({
  db: {
    get select() { return mockSelect; },
    get insert() { return mockInsert; },
  },
}));

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true },
}));

vi.mock('../../lib/mockStore.js', () => ({
  mockGet: vi.fn(),
}));

vi.mock('@smartshaadi/db', () => ({
  profiles:      { id: 'profiles.id', userId: 'profiles.userId' },
  profilePhotos: { profileId: 'profilePhotos.profileId', isPrimary: 'profilePhotos.isPrimary', r2Key: 'profilePhotos.r2Key' },
  profileViews:  {
    id:              'profileViews.id',
    viewerProfileId: 'profileViews.viewerProfileId',
    viewedProfileId: 'profileViews.viewedProfileId',
    viewedAt:        'profileViews.viewedAt',
  },
}));

vi.mock('../../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: { findOne: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq:   vi.fn((a, b) => ({ eq: [a, b] })),
  and:  vi.fn((...args) => ({ and: args })),
  desc: vi.fn((a) => ({ desc: a })),
  sql:  Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: String(strings), values })),
    { raw: vi.fn() },
  ),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { mockGet } from '../../lib/mockStore.js';
const mockGetFn = mockGet as ReturnType<typeof vi.fn>;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('trackView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult = [];
  });

  it('skips when viewerProfileId === viewedProfileId (self-view)', async () => {
    const { trackView } = await import('../views.service.js');
    await trackView('profile-a', 'user-a', 'profile-a');
    expect(mockGetFn).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips when viewer safetyMode.incognito is true', async () => {
    mockGetFn.mockReturnValueOnce({ safetyMode: { incognito: true } });
    const { trackView } = await import('../views.service.js');
    await trackView('profile-a', 'user-a', 'profile-b');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips when an existing view within 24 hours exists (24h dedupe)', async () => {
    mockGetFn.mockReturnValueOnce({ safetyMode: { incognito: false } });
    // Simulate existing row found
    mockQueryResult = [{ id: 'existing-view-id' }];
    const { trackView } = await import('../views.service.js');
    await trackView('profile-a', 'user-a', 'profile-b');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('inserts a new view row on happy path (not incognito, no recent duplicate)', async () => {
    mockGetFn.mockReturnValueOnce({ safetyMode: { incognito: false } });
    mockQueryResult = []; // no existing row
    const { trackView } = await import('../views.service.js');
    await trackView('profile-a', 'user-a', 'profile-b');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith({
      viewerProfileId: 'profile-a',
      viewedProfileId: 'profile-b',
    });
  });

  it('inserts a new view when safetyMode key is absent in mockStore (defaults incognito to false)', async () => {
    mockGetFn.mockReturnValueOnce({ personal: { fullName: 'Ravi' } }); // no safetyMode key
    mockQueryResult = [];
    const { trackView } = await import('../views.service.js');
    await trackView('profile-x', 'user-x', 'profile-y');
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

describe('getRecentViewers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult = [];
  });

  it('returns empty array when no views exist', async () => {
    mockQueryResult = [];
    const { getRecentViewers } = await import('../views.service.js');
    const result = await getRecentViewers('profile-z', 10);
    expect(result).toEqual([]);
  });

  it('deduplicates multiple views from the same viewer — returns only most recent', async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 3600 * 1000);

    // Over-fetch returns same viewer twice (most recent first, per DESC ordering in real DB)
    mockQueryResult = [
      { viewerProfileId: 'viewer-1', viewedAt: now,     userId: 'user-v1', verificationStatus: 'VERIFIED', primaryPhotoKey: 'photo.jpg' },
      { viewerProfileId: 'viewer-1', viewedAt: earlier, userId: 'user-v1', verificationStatus: 'VERIFIED', primaryPhotoKey: 'photo.jpg' },
      { viewerProfileId: 'viewer-2', viewedAt: earlier, userId: 'user-v2', verificationStatus: 'PENDING',  primaryPhotoKey: null },
    ];

    // loadPersonalContent calls mockGet once per unique viewer
    mockGetFn
      .mockReturnValueOnce({ personal: { fullName: 'Priya', dob: '1995-05-10' }, location: { city: 'Mumbai' } })
      .mockReturnValueOnce({ personal: { fullName: 'Arjun', dob: '1993-03-15' }, location: { city: 'Delhi' } });

    const { getRecentViewers } = await import('../views.service.js');
    const result = await getRecentViewers('profile-z', 10);

    expect(result).toHaveLength(2);
    expect(result[0]?.viewerProfileId).toBe('viewer-1');
    expect(result[0]?.viewedAt).toBe(now);  // most recent
    expect(result[1]?.viewerProfileId).toBe('viewer-2');
  });

  it('respects the limit parameter', async () => {
    // Return 10 unique viewers but limit=5
    mockQueryResult = Array.from({ length: 10 }, (_, i) => ({
      viewerProfileId:    `viewer-${i}`,
      viewedAt:           new Date(),
      userId:             `user-${i}`,
      verificationStatus: 'VERIFIED',
      primaryPhotoKey:    null,
    }));
    mockGetFn.mockReturnValue(null);

    const { getRecentViewers } = await import('../views.service.js');
    const result = await getRecentViewers('profile-z', 5);
    expect(result).toHaveLength(5);
  });

  it('returns enriched name, age, city from mockStore content', async () => {
    const viewedAt = new Date('2026-04-20T10:00:00Z');
    mockQueryResult = [
      { viewerProfileId: 'viewer-1', viewedAt, userId: 'user-v1', verificationStatus: 'VERIFIED', primaryPhotoKey: 'key.jpg' },
    ];
    mockGetFn.mockReturnValueOnce({
      personal: { fullName: 'Neha Sharma', dob: '2000-01-01' },
      location: { city: 'Pune' },
    });

    const { getRecentViewers } = await import('../views.service.js');
    const [viewer] = await getRecentViewers('profile-z', 10);

    expect(viewer?.name).toBe('Neha Sharma');
    expect(viewer?.city).toBe('Pune');
    expect(typeof viewer?.age).toBe('number');
    expect((viewer?.age ?? 0)).toBeGreaterThan(0);
    expect(viewer?.primaryPhotoKey).toBe('key.jpg');
    expect(viewer?.verificationStatus).toBe('VERIFIED');
  });

  it('handles null userId gracefully — returns Unknown name, null age and city', async () => {
    mockQueryResult = [
      { viewerProfileId: 'viewer-ghost', viewedAt: new Date(), userId: null, verificationStatus: 'PENDING', primaryPhotoKey: null },
    ];

    const { getRecentViewers } = await import('../views.service.js');
    const [viewer] = await getRecentViewers('profile-z', 10);

    expect(viewer?.name).toBe('Unknown');
    expect(viewer?.age).toBeNull();
    expect(viewer?.city).toBeNull();
  });
});
