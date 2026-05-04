import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mocks ───────────────────────────────────────────────────────────────────
// Vitest-style chain mocks. select().from().where() resolves to whatever the
// per-test setup queues in `selectQueue`.

const selectQueue: unknown[][] = [];

function makeSelectChain() {
  return {
    from:  vi.fn().mockReturnThis(),
    where: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
  };
}

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
  },
}));

vi.mock('@smartshaadi/db', () => ({
  profiles:        {},
  profilePhotos:   {},
  profileSections: {},
  communityZones:  {},
  user:            {},
}));

vi.mock('drizzle-orm', () => ({
  eq:  vi.fn(() => ({ type: 'eq' })),
  and: vi.fn(() => ({ type: 'and' })),
}));

vi.mock('../../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));

vi.mock('../content.service.js', () => ({
  computeAndUpdateCompleteness: vi.fn().mockResolvedValue(0),
  getMyProfileContent:          vi.fn().mockResolvedValue(null),
}));

vi.mock('../../storage/service.js', () => ({
  getPhotoUrl:  vi.fn().mockResolvedValue('https://mock.r2/photo.jpg'),
  getPhotoUrls: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true },
}));

vi.mock('../../lib/mockStore.js', () => ({
  mockGet: vi.fn(() => null),
}));

beforeEach(() => {
  selectQueue.length = 0;
  vi.clearAllMocks();
});

describe('profiles/service exports', () => {
  it('exports the public API', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.getMyProfile).toBe('function');
    expect(typeof mod.updateMyProfile).toBe('function');
    expect(typeof mod.addProfilePhoto).toBe('function');
    expect(typeof mod.getProfileById).toBe('function');
  });
});

describe('profiles/service > getProfileById privacy masking', () => {
  const profileRow = {
    id:                  'prof-1',
    userId:              'user-1',
    isActive:            true,
    verificationStatus:  'VERIFIED',
    premiumTier:         'FREE',
    profileCompleteness: 80,
    stayQuotient:        null,
    familyInclinationScore:  null,
    functionAttendanceScore: null,
    audioIntroKey:       null,
    videoIntroKey:       null,
    lastActiveAt:        null,
    createdAt:           new Date('2026-01-01'),
    updatedAt:           new Date('2026-01-02'),
  };
  const userRow = {
    id:          'user-1',
    name:        'Alice',
    role:        'INDIVIDUAL',
    status:      'ACTIVE',
    phoneNumber: '+919876543210',
    email:       'alice@example.com',
  };

  it('masks phone/email for non-self viewer', async () => {
    selectQueue.push([profileRow]);   // profiles.where(...)
    selectQueue.push([userRow]);      // user.where(...)
    selectQueue.push([]);             // profilePhotos.where(...)
    selectQueue.push([]);             // profileSections.where(...)

    const { getProfileById } = await import('../service.js');
    const out = await getProfileById('prof-1', 'user-OTHER');

    expect(out).toBeTruthy();
    expect(out!.phoneNumber).toBeNull();
    expect(out!.email).toBeNull();
    expect(out!.userId).toBe('user-1');
  });

  it('reveals phone/email when viewer is self', async () => {
    selectQueue.push([profileRow]);
    selectQueue.push([userRow]);
    selectQueue.push([]);
    selectQueue.push([]);

    const { getProfileById } = await import('../service.js');
    const out = await getProfileById('prof-1', 'user-1');

    expect(out).toBeTruthy();
    expect(out!.phoneNumber).toBe('+919876543210');
    expect(out!.email).toBe('alice@example.com');
  });

  it('returns null when profile is inactive', async () => {
    selectQueue.push([{ ...profileRow, isActive: false }]);

    const { getProfileById } = await import('../service.js');
    const out = await getProfileById('prof-1', 'user-1');
    expect(out).toBeNull();
  });

  it('returns null when profile not found', async () => {
    selectQueue.push([]);

    const { getProfileById } = await import('../service.js');
    const out = await getProfileById('nope', 'user-1');
    expect(out).toBeNull();
  });
});
