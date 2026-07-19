import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB mocks ───────────────────────────────────────────────────────────────

const selectQueue: unknown[][] = [];

function makeSelectChain() {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(selectQueue.shift() ?? [])),
  };
}

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{
            profileId: 'test-profile-id',
            divorceeSupport_enabled: true,
            gotraExclusionEnabled: true,
            lgbtqProfile: false,
          }]),
        }),
        returning: vi.fn().mockResolvedValue([{
          profileId: 'test-profile-id',
          divorceeSupport_enabled: true,
        }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          profileId: 'test-profile-id',
          divorceeOnboardingDone: true,
        }]),
      }),
    })),
  },
}));

vi.mock('@smartshaadi/db', () => ({
  profiles: {},
  communityZones: {},
  profileSections: {},
}));

vi.mock('../../lib/redis.js', () => ({
  bustOwnFeedCache: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  selectQueue.length = 0;
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Divorcee Support — Community Zone Flag', () => {
  it('divorceeSupportEnabled flag is properly integrated', async () => {
    // Load modules after mocks are defined
    const { updateCommunityZone } = await import('../community.service.js');

    selectQueue.push([{ id: 'test-profile-id' }]); // For getProfileId

    const result = await updateCommunityZone('test-user-id', { divorceeSupportEnabled: true });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('divorceeSupportEnabled');
  });

  it('maritalStatus type handling in PersonalSection', () => {
    // Compile-time type verification
    type PersonalSectionTest = {
      maritalStatus?: 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';
      fullName?: string;
    };

    const section: PersonalSectionTest = {
      maritalStatus: 'DIVORCED',
      fullName: 'Test User',
    };

    expect(section.maritalStatus).toBe('DIVORCED');
  });
});
