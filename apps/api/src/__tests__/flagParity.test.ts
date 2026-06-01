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

  it('production (all false) → both stores live', () => {
    expect(deriveMockFlags(false, false, false)).toEqual({ shouldUseMockMongo: false, shouldUseMockR2: false });
  });
  it('mock master only → both stores mock', () => {
    expect(deriveMockFlags(true, false, false)).toEqual({ shouldUseMockMongo: true, shouldUseMockR2: true });
  });
  it('mock + MONGO_LIVE → mongo live, r2 mock (incremental cutover)', () => {
    expect(deriveMockFlags(true, true, false)).toEqual({ shouldUseMockMongo: false, shouldUseMockR2: true });
  });
  it('mock + R2_LIVE → r2 live, mongo mock', () => {
    expect(deriveMockFlags(true, false, true)).toEqual({ shouldUseMockMongo: true, shouldUseMockR2: false });
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
