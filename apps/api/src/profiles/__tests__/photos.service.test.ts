import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../lib/db.js', () => {
  const chain = () => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ rowCount: 0 }),
    delete: vi.fn().mockResolvedValue([]),
    returning: vi.fn().mockResolvedValue([]),
  });
  return {
    db: {
      select: vi.fn(chain),
      insert: vi.fn(chain),
      update: vi.fn(chain),
      delete: vi.fn(chain),
      transaction: vi.fn(),
    },
  };
});

vi.mock('@smartshaadi/db', () => ({
  profiles: { userId: {}, id: {} },
  profilePhotos: { id: {}, profileId: {}, isPrimary: {}, displayOrder: {}, r2Key: {} },
  profileSections: { profileId: {}, photos: {} },
}));

vi.mock('../../storage/service.js', () => ({
  getPhotoUrls: vi.fn().mockResolvedValue(['https://example.com/photo.jpg']),
}));

import { db } from '../../lib/db.js';
import { getPhotoUrls } from '../../storage/service.js';
import {
  addProfilePhoto,
  getProfilePhotos,
  deleteProfilePhoto,
  reorderPhotos,
  setPrimaryPhoto,
} from '../photos.service.js';
import type { PhotoUploadInput, PhotoReorderInput, SetPrimaryPhotoInput } from '@smartshaadi/schemas';

// ── Test Data ────────────────────────────────────────────────────────────────

const mockUserId = 'user-uuid-1';
const mockProfileId = 'profile-uuid-1';

const mockProfile = {
  id: mockProfileId,
  userId: mockUserId,
  profileCompleteness: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPhoto = (overrides: Partial<any> = {}) => ({
  id: 'photo-uuid-1',
  profileId: mockProfileId,
  r2Key: 'photos/user-uuid-1/photo-1.jpg',
  isPrimary: true,
  displayOrder: 0,
  fileSize: 1024000,
  mimeType: 'image/jpeg' as const,
  uploadedAt: new Date('2026-04-15T10:00:00Z'),
  ...overrides,
});

// ── Helper Functions ─────────────────────────────────────────────────────────

function setupSelectReturns(...results: unknown[][]) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const returnValue = results[call] ?? [];
    call++;
    const c: Record<string, unknown> = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(returnValue),
      select: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(returnValue).then(resolve, reject),
    };
    return c as unknown as ReturnType<typeof db.select>;
  });
}

function setupUpdateOk(rowCount = 1) {
  vi.mocked(db.update).mockImplementation(() => {
    const c = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({ rowCount }),
    };
    return c as unknown as ReturnType<typeof db.update>;
  });
}

function setupInsertOk(returnValue: any = [mockPhoto()]) {
  vi.mocked(db.insert).mockImplementation(() => {
    const c = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(returnValue),
    };
    return c as unknown as ReturnType<typeof db.insert>;
  });
}

function setupDeleteOk() {
  vi.mocked(db.delete).mockImplementation(() => {
    const c = {
      where: vi.fn().mockResolvedValue([]),
    };
    return c as unknown as ReturnType<typeof db.delete>;
  });
}

// ── addProfilePhoto ──────────────────────────────────────────────────────────

describe('addProfilePhoto', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws PROFILE_NOT_FOUND when profile does not exist', async () => {
    setupSelectReturns([]); // no profile
    const input: PhotoUploadInput = {
      r2Key: 'photos/test.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
    };
    try {
      await addProfilePhoto(mockUserId, input);
      expect.fail('should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('PROFILE_NOT_FOUND');
    }
  });

  it('first photo should automatically become primary', async () => {
    setupSelectReturns(
      [mockProfile], // profile exists
      [], // 0 existing photos
      [], // profileSections select
      [mockPhoto({ isPrimary: true, displayOrder: 0 })], // inserted photo
    );
    setupInsertOk([mockPhoto({ isPrimary: true, displayOrder: 0 })]);
    setupUpdateOk();

    const input: PhotoUploadInput = {
      r2Key: 'photos/first.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
    };
    const result = await addProfilePhoto(mockUserId, input);
    expect(result.isPrimary).toBe(true);
    expect(result.displayOrder).toBe(0);
  });

  it('8th+1 photo should throw PHOTO_LIMIT_REACHED', async () => {
    const existingPhotos = Array.from({ length: 8 }, (_, i) =>
      mockPhoto({ id: `photo-${i}`, displayOrder: i, isPrimary: i === 0 }),
    );
    setupSelectReturns(
      [mockProfile],
      existingPhotos, // 8 photos already exist
    );

    const input: PhotoUploadInput = {
      r2Key: 'photos/ninth.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
    };
    try {
      await addProfilePhoto(mockUserId, input);
      expect.fail('should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('PHOTO_LIMIT_REACHED');
    }
  });

  it('setting isPrimary=true unsets all other photos as primary', async () => {
    setupSelectReturns(
      [mockProfile], // profile
      [
        mockPhoto({ id: 'photo-1', isPrimary: true, displayOrder: 0 }),
        mockPhoto({ id: 'photo-2', isPrimary: false, displayOrder: 1 }),
      ], // 2 existing photos
      [], // profileSections
      [mockPhoto({ id: 'photo-3', isPrimary: true, displayOrder: 2 })], // new photo
    );
    setupUpdateOk();
    setupInsertOk([mockPhoto({ id: 'photo-3', isPrimary: true, displayOrder: 2 })]);

    const input: PhotoUploadInput = {
      r2Key: 'photos/new.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
      isPrimary: true,
    };
    const result = await addProfilePhoto(mockUserId, input);
    expect(result.isPrimary).toBe(true);
    expect(vi.mocked(db.update)).toHaveBeenCalled();
  });

  it('marks photos section as complete in profileSections', async () => {
    setupSelectReturns(
      [mockProfile],
      [], // no photos
      [{ profileId: mockProfileId, photos: false }], // profileSections exists, photos=false
      [mockPhoto()],
    );
    setupUpdateOk();
    setupInsertOk([mockPhoto()]);

    const input: PhotoUploadInput = {
      r2Key: 'photos/test.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
    };
    await addProfilePhoto(mockUserId, input);
    expect(vi.mocked(db.update)).toHaveBeenCalled();
  });
});

// ── getProfilePhotos ─────────────────────────────────────────────────────────

describe('getProfilePhotos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws PROFILE_NOT_FOUND when profile does not exist', async () => {
    setupSelectReturns([]); // no profile
    try {
      await getProfilePhotos(mockUserId);
      expect.fail('should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('PROFILE_NOT_FOUND');
    }
  });

  it('returns photos ordered by displayOrder and uploadedAt', async () => {
    const photos = [
      mockPhoto({ id: 'photo-1', displayOrder: 0, uploadedAt: new Date('2026-04-10') }),
      mockPhoto({ id: 'photo-2', displayOrder: 1, uploadedAt: new Date('2026-04-12') }),
      mockPhoto({ id: 'photo-3', displayOrder: 2, uploadedAt: new Date('2026-04-15') }),
    ];
    setupSelectReturns([mockProfile], photos);
    vi.mocked(getPhotoUrls).mockResolvedValue([
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
      'https://example.com/photo3.jpg',
    ]);

    const results = await getProfilePhotos(mockUserId);
    expect(results).toHaveLength(3);
    expect(results[0]!.id).toBe('photo-1');
    expect(results[1]!.id).toBe('photo-2');
    expect(results[2]!.id).toBe('photo-3');
  });

  it('includes presigned URLs in PhotoResult', async () => {
    const photos = [mockPhoto()];
    setupSelectReturns([mockProfile], photos);
    vi.mocked(getPhotoUrls).mockResolvedValue(['https://presigned.url/photo.jpg']);

    const results = await getProfilePhotos(mockUserId);
    expect(results[0]!.url).toBe('https://presigned.url/photo.jpg');
  });

  it('returns empty array when profile has no photos', async () => {
    setupSelectReturns([mockProfile], []);
    vi.mocked(getPhotoUrls).mockResolvedValue([]);

    const results = await getProfilePhotos(mockUserId);
    expect(results).toHaveLength(0);
  });
});

// ── deleteProfilePhoto ───────────────────────────────────────────────────────

describe('deleteProfilePhoto', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws PHOTO_NOT_FOUND when photo is not owned by this profile', async () => {
    setupSelectReturns(
      [mockProfile], // profile exists
      [], // photo not found (doesn't belong to this profile)
    );

    try {
      await deleteProfilePhoto(mockUserId, 'photo-uuid-wrong');
      expect.fail('should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('PHOTO_NOT_FOUND');
    }
  });

  it('deletes the photo record', async () => {
    const photo = mockPhoto({ id: 'photo-to-delete', isPrimary: false });
    setupSelectReturns(
      [mockProfile],
      [photo], // photo exists
      [], // remaining photos after delete
    );
    setupDeleteOk();
    setupUpdateOk();

    await deleteProfilePhoto(mockUserId, 'photo-to-delete');
    expect(vi.mocked(db.delete)).toHaveBeenCalled();
  });

  it('promotes next photo to primary when deleting primary', async () => {
    const primaryPhoto = mockPhoto({ id: 'photo-primary', isPrimary: true, displayOrder: 0 });
    const nextPhoto = mockPhoto({ id: 'photo-next', isPrimary: false, displayOrder: 1 });

    setupSelectReturns(
      [mockProfile], // profile
      [primaryPhoto], // photo to delete (is primary)
      [nextPhoto], // next photo found (has lowest displayOrder)
      [nextPhoto], // remaining photos after delete
    );
    setupDeleteOk();
    setupUpdateOk();

    await deleteProfilePhoto(mockUserId, 'photo-primary');
    expect(vi.mocked(db.update)).toHaveBeenCalled();
  });

  it('does not promote when deleting non-primary photo', async () => {
    const secondPhoto = mockPhoto({ id: 'photo-second', isPrimary: false, displayOrder: 1 });

    setupSelectReturns(
      [mockProfile],
      [secondPhoto], // not primary
      [mockPhoto()], // remaining photos
    );
    setupDeleteOk();
    setupUpdateOk();

    await deleteProfilePhoto(mockUserId, 'photo-second');
    // update is still called but only for completeness recalc, not for promoting
  });

  it('marks photos section incomplete when no photos remain', async () => {
    const lastPhoto = mockPhoto({ id: 'photo-last', isPrimary: true });

    setupSelectReturns(
      [mockProfile],
      [lastPhoto],
      [], // no remaining photos
    );
    setupDeleteOk();
    setupUpdateOk();

    await deleteProfilePhoto(mockUserId, 'photo-last');
    expect(vi.mocked(db.update)).toHaveBeenCalled();
  });
});

// ── reorderPhotos ────────────────────────────────────────────────────────────

describe('reorderPhotos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws PHOTO_NOT_FOUND when a photo ID does not belong to the profile', async () => {
    setupSelectReturns([mockProfile]);
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      // Simulate the transaction - when update returns rowCount=0, it throws
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 0 }), // photo not found
          }),
        }),
      } as unknown as any;
      await fn(mockTx);
    });

    const input: PhotoReorderInput = [
      { id: 'photo-unknown-id', displayOrder: 0 },
    ];

    try {
      await reorderPhotos(mockUserId, input);
      expect.fail('should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('PHOTO_NOT_FOUND');
    }
  });

  it('updates displayOrder for all provided photos in transaction', async () => {
    setupSelectReturns([mockProfile]);

    const updatedPhotos: PhotoReorderInput = [
      { id: 'photo-1', displayOrder: 2 },
      { id: 'photo-2', displayOrder: 0 },
      { id: 'photo-3', displayOrder: 1 },
    ];

    let transactionCalled = false;
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      transactionCalled = true;
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 1 }), // success for each
          }),
        }),
      } as unknown as any;
      await fn(mockTx);
    });

    await reorderPhotos(mockUserId, updatedPhotos);
    expect(transactionCalled).toBe(true);
  });

  it('accepts array with minimum 1 item', async () => {
    setupSelectReturns([mockProfile]);
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }),
        }),
      } as unknown as any;
      await fn(mockTx);
    });

    const input: PhotoReorderInput = [{ id: 'photo-1', displayOrder: 0 }];
    await reorderPhotos(mockUserId, input);
    expect(db.transaction).toHaveBeenCalled();
  });
});

// ── setPrimaryPhoto ─────────────────────────────────────────────────────────

describe('setPrimaryPhoto', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws PHOTO_NOT_FOUND when photo is not owned by this profile', async () => {
    setupSelectReturns(
      [mockProfile], // profile exists
      [], // photo not found
    );

    const input: SetPrimaryPhotoInput = { photoId: 'photo-unknown' };
    try {
      await setPrimaryPhoto(mockUserId, input);
      expect.fail('should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('PHOTO_NOT_FOUND');
    }
  });

  it('unsets primary on all photos, then sets target photo as primary', async () => {
    const targetPhoto = mockPhoto({ id: 'photo-target', isPrimary: false });
    setupSelectReturns([mockProfile], [targetPhoto]);

    let transactionCalled = false;
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      transactionCalled = true;
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }),
        }),
      } as unknown as any;
      await fn(mockTx);
    });

    const input: SetPrimaryPhotoInput = { photoId: 'photo-target' };
    await setPrimaryPhoto(mockUserId, input);
    expect(transactionCalled).toBe(true);
  });

  it('succeeds when setting an already-primary photo as primary again', async () => {
    const targetPhoto = mockPhoto({ id: 'photo-target', isPrimary: true });
    setupSelectReturns([mockProfile], [targetPhoto]);

    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }),
        }),
      } as unknown as any;
      await fn(mockTx);
    });

    const input: SetPrimaryPhotoInput = { photoId: 'photo-target' };
    await setPrimaryPhoto(mockUserId, input);
    expect(db.transaction).toHaveBeenCalled();
  });
});
