/**
 * Flag-parity smoke test — the demo-week safety net.
 *
 * The demo-week bug: a store's READ path and WRITE path consulted different
 * mock/live flags, so ProfileContent writes went to real Mongo while reads
 * returned stale mock JSON (or vice-versa). This test locks in two guarantees:
 *
 *  A. The derived gates follow one formula for all 8 flag combinations.
 *  B. For each store, the READ and WRITE paths hit the SAME backend — both mock
 *     or both live — under each flag value. If someone makes a read path ignore
 *     MONGO_LIVE/R2_LIVE while the write path respects it, an assertion fails.
 */
import { describe, it, expect, vi } from 'vitest';
import { deriveMockFlags } from '../lib/env.js';

// ── A. Truth table (pure formula) ───────────────────────────────────────────
describe('deriveMockFlags truth table', () => {
  const combos: Array<[boolean, boolean, boolean]> = [
    [false, false, false], [false, false, true], [false, true, false], [false, true, true],
    [true, false, false], [true, false, true], [true, true, false], [true, true, true],
  ];

  it.each(combos)('useMock=%s mongoLive=%s r2Live=%s → correct gates', (u, m, r) => {
    const { shouldUseMockMongo, shouldUseMockR2 } = deriveMockFlags(u, m, r);
    expect(shouldUseMockMongo).toBe(u && !m);
    expect(shouldUseMockR2).toBe(u && !r);
  });

  it('includes shouldUseMockEsign in return value', () => {
    const result = deriveMockFlags(false, false, false, false, false, false);
    expect(result).toHaveProperty('shouldUseMockEsign');
  });

  // kycLive omitted → defaults false → shouldUseMockKyc = useMock || !false = true in every row.
  it('production (all false) → both stores live, KYC mocked', () => {
    expect(deriveMockFlags(false, false, false)).toEqual({ shouldUseMockMongo: false, shouldUseMockR2: false, shouldUseMockKyc: true, shouldUseMockVideo: false, shouldUseMockEsign: true });
  });
  it('mock master only → both stores mock', () => {
    expect(deriveMockFlags(true, false, false)).toEqual({ shouldUseMockMongo: true, shouldUseMockR2: true, shouldUseMockKyc: true, shouldUseMockVideo: true, shouldUseMockEsign: true });
  });
  it('mock + MONGO_LIVE → mongo live, r2 mock (incremental cutover)', () => {
    expect(deriveMockFlags(true, true, false)).toEqual({ shouldUseMockMongo: false, shouldUseMockR2: true, shouldUseMockKyc: true, shouldUseMockVideo: true, shouldUseMockEsign: true });
  });
  it('mock + R2_LIVE → r2 live, mongo mock', () => {
    expect(deriveMockFlags(true, false, true)).toEqual({ shouldUseMockMongo: true, shouldUseMockR2: false, shouldUseMockKyc: true, shouldUseMockVideo: true, shouldUseMockEsign: true });
  });
});

// ── A2b. E-sign gate (INVERTED ESIGN_LIVE semantics, like KYC) ────────────────
// Unlike MONGO_LIVE/R2_LIVE (escape to live EARLY), ESIGN_LIVE keeps E-SIGN MOCKED even
// after the master toggle flips off. Real e-sign only when ESIGN_LIVE=true AND master off.
describe('shouldUseMockEsign (ESIGN_LIVE inverted override)', () => {
  it('master off + ESIGN_LIVE unset → e-sign stays MOCKED', () => {
    expect(deriveMockFlags(false, false, false, false, false, false).shouldUseMockEsign).toBe(true);
  });
  it('master off + ESIGN_LIVE=true → e-sign goes REAL (provider credentials configured)', () => {
    expect(deriveMockFlags(false, false, false, false, false, true).shouldUseMockEsign).toBe(false);
  });
  it('master on → e-sign MOCKED regardless of ESIGN_LIVE', () => {
    expect(deriveMockFlags(true, false, false, false, false, false).shouldUseMockEsign).toBe(true);
    expect(deriveMockFlags(true, false, false, false, false, true).shouldUseMockEsign).toBe(true);
  });
  it('esignLive param defaults to false (mocked) when omitted', () => {
    expect(deriveMockFlags(false, false, false).shouldUseMockEsign).toBe(true);
  });
});

// ── A3. Video gate (VIDEO_LIVE escape-early, same shape as R2_LIVE) ───────────
describe('shouldUseMockVideo (VIDEO_LIVE early-escape override)', () => {
  it('master on + VIDEO_LIVE unset → video MOCKED', () => {
    expect(deriveMockFlags(true, false, false, false, false).shouldUseMockVideo).toBe(true);
  });
  it('master on + VIDEO_LIVE=true → video REAL (Daily.co live while others mocked)', () => {
    expect(deriveMockFlags(true, false, false, false, true).shouldUseMockVideo).toBe(false);
  });
  it('master off → video REAL regardless of VIDEO_LIVE', () => {
    expect(deriveMockFlags(false, false, false, false, false).shouldUseMockVideo).toBe(false);
    expect(deriveMockFlags(false, false, false, false, true).shouldUseMockVideo).toBe(false);
  });
  it('videoLive param defaults to false (mocked under master on) when omitted', () => {
    expect(deriveMockFlags(true, false, false).shouldUseMockVideo).toBe(true);
  });
});

// ── A2. KYC gate (INVERTED KYC_LIVE semantics) ───────────────────────────────
// Unlike MONGO_LIVE/R2_LIVE (escape to live EARLY), KYC_LIVE keeps KYC MOCKED even
// after the master toggle flips off. Real KYC only when KYC_LIVE=true AND master off.
describe('shouldUseMockKyc (KYC_LIVE inverted override)', () => {
  it('master off + KYC_LIVE unset → KYC stays MOCKED (the payment-launch case)', () => {
    expect(deriveMockFlags(false, false, false, false).shouldUseMockKyc).toBe(true);
  });
  it('master off + KYC_LIVE=true → KYC goes REAL (DigiLocker registered)', () => {
    expect(deriveMockFlags(false, false, false, true).shouldUseMockKyc).toBe(false);
  });
  it('master on → KYC MOCKED regardless of KYC_LIVE', () => {
    expect(deriveMockFlags(true, false, false, false).shouldUseMockKyc).toBe(true);
    expect(deriveMockFlags(true, false, false, true).shouldUseMockKyc).toBe(true);
  });
  it('kycLive param defaults to false (mocked) when omitted', () => {
    expect(deriveMockFlags(false, false, false).shouldUseMockKyc).toBe(true);
  });
});

// ── B3. KYC service mock parity (kyc/aadhaar.ts — the DigiLocker swap point) ──
async function loadAadhaar(useMockKyc: boolean) {
  vi.resetModules();
  vi.doMock('../lib/env.js', () => ({
    shouldUseMockKyc: useMockKyc,
    shouldUseMockMongo: false,
    shouldUseMockR2: false,
    env: {},
  }));
  return import('../kyc/aadhaar.js');
}

describe('KYC mock parity (kyc/aadhaar)', () => {
  it('shouldUseMockKyc=true → verifyDigiLockerCallback returns mock {verified, refId}', async () => {
    const aadhaar = await loadAadhaar(true);
    const result = await aadhaar.verifyDigiLockerCallback('any-code');
    expect(result.verified).toBe(true);
    expect(result.refId).toMatch(/^MOCK-/);
  });

  it('shouldUseMockKyc=false → verifyDigiLockerCallback throws (real DigiLocker unconfigured)', async () => {
    const aadhaar = await loadAadhaar(false);
    await expect(aadhaar.verifyDigiLockerCallback('any-code')).rejects.toThrow('Real DigiLocker client not yet configured');
  });
});

// ── B1. Mongo store read/write parity (content.service.ts) ───────────────────
async function loadContentService(useMockMongo: boolean) {
  vi.resetModules();
  const mockGet = vi.fn().mockReturnValue({ userId: 'u1' });
  const mockUpsertField = vi.fn().mockReturnValue({ userId: 'u1' });
  const findOneLean = vi.fn().mockResolvedValue({ userId: 'u1' });
  const findOne = vi.fn(() => ({ lean: findOneLean }));
  const findOneAndUpdate = vi.fn().mockResolvedValue({ userId: 'u1' });

  vi.doMock('../lib/env.js', () => ({
    shouldUseMockMongo: useMockMongo,
    shouldUseMockR2: false,
    env: {},
  }));
  vi.doMock('../lib/mockStore.js', () => ({ mockGet, mockUpsertField, mockUpsertDotFields: vi.fn() }));
  vi.doMock('../infrastructure/mongo/models/ProfileContent.js', () => ({
    ProfileContent: { findOne, findOneAndUpdate },
  }));
  vi.doMock('../lib/db.js', () => ({ db: {} }));
  vi.doMock('../lib/redis.js', () => ({ bustOwnFeedCache: vi.fn() }));

  const svc = await import('../profiles/content.service.js');
  return { svc, mockGet, mockUpsertField, findOne, findOneAndUpdate };
}

describe('Mongo store read/write parity (content.service)', () => {
  it('shouldUseMockMongo=true → read AND write use mockStore, Mongo model untouched', async () => {
    const { svc, mockGet, mockUpsertField, findOne, findOneAndUpdate } = await loadContentService(true);
    await svc.getMyProfileContent('u1');               // READ
    await svc.updatePersonal('u1', { fullName: 'x' }); // WRITE
    expect(mockGet).toHaveBeenCalled();
    expect(mockUpsertField).toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('shouldUseMockMongo=false → read AND write use Mongo model, mockStore untouched', async () => {
    const { svc, mockGet, mockUpsertField, findOne, findOneAndUpdate } = await loadContentService(false);
    await svc.getMyProfileContent('u1');               // READ
    await svc.updatePersonal('u1', { fullName: 'x' }); // WRITE
    expect(findOne).toHaveBeenCalled();
    expect(findOneAndUpdate).toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUpsertField).not.toHaveBeenCalled();
  });
});

// ── B2. R2 store read/write parity (storage/service.ts) ──────────────────────
async function loadStorageService(useMockR2: boolean) {
  vi.resetModules();
  const getSignedUrl = vi.fn().mockResolvedValue('https://real-r2.example/signed');

  vi.doMock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }));
  vi.doMock('@aws-sdk/client-s3', () => ({
    S3Client: class {}, GetObjectCommand: class {}, PutObjectCommand: class {},
  }));
  vi.doMock('../lib/env.js', () => ({
    shouldUseMockR2: useMockR2,
    shouldUseMockMongo: false,
    env: {
      API_BASE_URL: 'http://api.test',
      CLOUDFLARE_R2_ACCOUNT_ID: 'acc',
      CLOUDFLARE_R2_ACCESS_KEY: 'key',
      CLOUDFLARE_R2_SECRET_KEY: 'secret',
      CLOUDFLARE_R2_BUCKET: 'bucket',
    },
  }));

  const svc = await import('../storage/service.js');
  return { svc, getSignedUrl };
}

describe('R2 store read/write parity (storage/service)', () => {
  it('shouldUseMockR2=true → read AND write return /__mock-r2 URLs, getSignedUrl untouched', async () => {
    const { svc, getSignedUrl } = await loadStorageService(true);
    const readUrl = await svc.getPhotoUrl('photos/a.jpg');                       // READ
    const write = await svc.getPresignedUploadUrl('photos', 'a.jpg', 'image/jpeg'); // WRITE
    expect(readUrl).toContain('/__mock-r2/');
    expect(write.uploadUrl).toContain('/__mock-r2/upload/');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('shouldUseMockR2=false → read AND write call real getSignedUrl', async () => {
    const { svc, getSignedUrl } = await loadStorageService(false);
    await svc.getPhotoUrl('photos/a.jpg');                       // READ
    await svc.getPresignedUploadUrl('photos', 'a.jpg', 'image/jpeg'); // WRITE
    expect(getSignedUrl).toHaveBeenCalledTimes(2);
  });
});

// ── B4. Video (Daily.co) mock parity (lib/dailyco.ts — the room swap point) ───
async function loadDailyco(useMockVideo: boolean) {
  vi.resetModules();
  const fetchMock = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({
      id: 'real_1', name: 'match-1', url: 'https://smartshaadi.daily.co/match-1',
      createdAt: '2026-07-01T00:00:00Z', expiresAt: '2026-07-01T01:00:00Z',
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.doMock('../lib/env.js', () => ({
    shouldUseMockVideo: useMockVideo,
    env: { DAILY_CO_API_KEY: 'real-key' },
  }));
  const dailyco = await import('../lib/dailyco.js');
  return { dailyco, fetchMock };
}

describe('Video mock parity (lib/dailyco)', () => {
  it('shouldUseMockVideo=true → createRoom returns a mock room, Daily.co API untouched', async () => {
    const { dailyco, fetchMock } = await loadDailyco(true);
    const room = await dailyco.createRoom('match-1', 60);
    expect(room.isMock).toBe(true);
    expect(room.url).toContain('smartshaadi.daily.co');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shouldUseMockVideo=false → createRoom calls the real Daily.co API', async () => {
    const { dailyco, fetchMock } = await loadDailyco(false);
    const room = await dailyco.createRoom('match-1', 60);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.daily.co/v1/rooms', expect.objectContaining({ method: 'POST' }));
    expect(room.isMock).toBeUndefined();
  });
});
