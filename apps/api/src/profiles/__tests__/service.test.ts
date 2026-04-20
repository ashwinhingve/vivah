import { describe, it, expect, vi } from 'vitest';

// Stub tests — full coverage added in Phase 2 when DB fixtures are available.
// These ensure the module imports cleanly and key exports exist.

vi.mock('../../lib/db.js', () => ({ db: {} }));
vi.mock('@smartshaadi/db', () => ({
  profiles: {},
  profilePhotos: {},
  profileSections: {},
  communityZones: {},
  user: {},
}));
vi.mock('../../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../content.service.js', () => ({
  computeAndUpdateCompleteness: vi.fn().mockResolvedValue(0),
  getMyProfileContent: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../storage/service.js', () => ({
  getPhotoUrl: vi.fn().mockResolvedValue('https://mock.r2/photo.jpg'),
  getPhotoUrls: vi.fn().mockResolvedValue([]),
}));

describe('profiles/service', () => {
  it('exports getMyProfile', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.getMyProfile).toBe('function');
  }, 15000);

  it('exports updateMyProfile', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.updateMyProfile).toBe('function');
  });

  it('exports addProfilePhoto', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.addProfilePhoto).toBe('function');
  });

  it('exports getProfileById', async () => {
    const mod = await import('../service.js');
    expect(typeof mod.getProfileById).toBe('function');
  });
});
