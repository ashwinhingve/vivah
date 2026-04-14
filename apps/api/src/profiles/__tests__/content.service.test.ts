import { describe, it, expect, vi } from 'vitest';

// Stub tests — full coverage added in Phase 2 when MongoDB fixtures are available.

vi.mock('../../infrastructure/mongo/models/ProfileContent.js', () => ({
  ProfileContent: {
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
  },
}));

describe('profiles/content.service', () => {
  it('exports getMyProfileContent', async () => {
    const mod = await import('../content.service.js');
    expect(typeof mod.getMyProfileContent).toBe('function');
  });

  it('exports updatePersonal', async () => {
    const mod = await import('../content.service.js');
    expect(typeof mod.updatePersonal).toBe('function');
  });

  it('exports updateHoroscope', async () => {
    const mod = await import('../content.service.js');
    expect(typeof mod.updateHoroscope).toBe('function');
  });

  it('exports updatePartnerPreferences', async () => {
    const mod = await import('../content.service.js');
    expect(typeof mod.updatePartnerPreferences).toBe('function');
  });
});
