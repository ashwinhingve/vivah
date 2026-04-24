import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  getMyProfile,
  updateMyProfile,
  getProfileById,
} from './service.js';
import * as photosService from './photos.service.js';
import { PhotoUploadSchema, PhotoReorderSchema, SetPrimaryPhotoSchema } from '@smartshaadi/schemas';
import { profileContentRouter } from './content.router.js';
import { horoscopeRouter } from './horoscope.router.js';
import { preferencesRouter } from './preferences.router.js';
import { communityRouter } from './community.router.js';
import { safetyRouter } from './safety.router.js';
import { trackView, getRecentViewers } from './views.service.js';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles } from '@smartshaadi/db';

export const profilesRouter = Router();

/**
 * GET /api/v1/profiles/me
 * Returns the authenticated user's own profile (full contact visible).
 * Creates a profile row automatically on first call.
 */
profilesRouter.get('/me', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const profile = await getMyProfile(req.user!.id);
  if (!profile) {
    err(res, 'USER_NOT_FOUND', 'User not found', 404);
    return;
  }
  ok(res, profile);
}));

const UpdateProfileSchema = z.object({
  stayQuotient:            z.enum(['INDEPENDENT', 'WITH_PARENTS', 'WITH_INLAWS', 'FLEXIBLE']).optional(),
  familyInclinationScore:  z.number().int().min(0).max(100).optional(),
  functionAttendanceScore: z.number().int().min(0).max(100).optional(),
  isActive:                z.boolean().optional(),
});

/**
 * PUT /api/v1/profiles/me
 * Updates mutable profile fields for the authenticated user.
 */
profilesRouter.put('/me', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }

  // Strip Zod's `| undefined` from optional fields to satisfy exactOptionalPropertyTypes
  const input: import('./service.js').UpdateProfileInput = {};
  if (parsed.data.stayQuotient            != null) input.stayQuotient            = parsed.data.stayQuotient;
  if (parsed.data.familyInclinationScore  != null) input.familyInclinationScore  = parsed.data.familyInclinationScore;
  if (parsed.data.functionAttendanceScore != null) input.functionAttendanceScore = parsed.data.functionAttendanceScore;
  if (parsed.data.isActive                != null) input.isActive                = parsed.data.isActive;

  const profile = await updateMyProfile(req.user!.id, input);
  if (!profile) {
    err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
    return;
  }
  ok(res, profile);
}));

/**
 * POST /api/v1/profiles/me/photos
 * Records a photo that was already uploaded directly to R2 via pre-signed URL.
 * Body: { r2Key, fileSize, mimeType, isPrimary?, displayOrder? }
 */
profilesRouter.post('/me/photos', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = PhotoUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }

  const input: import('@smartshaadi/schemas').PhotoUploadInput = {
    r2Key: parsed.data.r2Key,
    fileSize: parsed.data.fileSize,
    mimeType: parsed.data.mimeType,
  };
  if (parsed.data.isPrimary    != null) input.isPrimary    = parsed.data.isPrimary;
  if (parsed.data.displayOrder != null) input.displayOrder = parsed.data.displayOrder;

  try {
    const photo = await photosService.addProfilePhoto(req.user!.id, input);
    ok(res, photo, 201);
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PHOTO_LIMIT_REACHED') {
      err(res, 'PHOTO_LIMIT_REACHED', 'Maximum 8 photos allowed', 422);
    } else if (name === 'PROFILE_NOT_FOUND') {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
    } else {
      throw e;
    }
  }
});

/**
 * DELETE /api/v1/profiles/me/photos/:photoId
 * Removes a photo record by photo UUID (does not delete from R2 — caller handles that).
 */
profilesRouter.delete('/me/photos/:photoId', authenticate, async (req: Request, res: Response): Promise<void> => {
  const photoId = req.params['photoId'] ?? '';

  try {
    await photosService.deleteProfilePhoto(req.user!.id, photoId);
    ok(res, { deleted: true });
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PHOTO_NOT_FOUND') {
      err(res, 'PHOTO_NOT_FOUND', 'Photo not found or not owned by this user', 404);
    } else if (name === 'PROFILE_NOT_FOUND') {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
    } else {
      throw e;
    }
  }
});

/**
 * GET /api/v1/profiles/me/photos
 * Returns all photos for the authenticated user's profile with presigned URLs.
 */
profilesRouter.get('/me/photos', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const photos = await photosService.getProfilePhotos(req.user!.id);
    ok(res, photos);
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PROFILE_NOT_FOUND') {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
    } else {
      throw e;
    }
  }
});

/**
 * PUT /api/v1/profiles/me/photos/reorder
 * Reorders photos by updating displayOrder for each photo in the provided list.
 */
profilesRouter.put('/me/photos/reorder', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = PhotoReorderSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }

  try {
    await photosService.reorderPhotos(req.user!.id, parsed.data);
    ok(res, { reordered: true });
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PHOTO_NOT_FOUND') {
      err(res, 'PHOTO_NOT_FOUND', 'One or more photos not found', 404);
    } else if (name === 'PROFILE_NOT_FOUND') {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
    } else {
      throw e;
    }
  }
});

/**
 * PUT /api/v1/profiles/me/photos/primary
 * Sets a photo as the primary (main) profile photo.
 */
profilesRouter.put('/me/photos/primary', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = SetPrimaryPhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }

  try {
    await photosService.setPrimaryPhoto(req.user!.id, { photoId: parsed.data.photoId });
    ok(res, { updated: true });
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PHOTO_NOT_FOUND') {
      err(res, 'PHOTO_NOT_FOUND', 'Photo not found or not owned by this user', 404);
    } else if (name === 'PROFILE_NOT_FOUND') {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
    } else {
      throw e;
    }
  }
});

/**
 * GET /api/v1/profiles/me/viewers
 * Returns paginated list of profiles who recently viewed the current user.
 * Deduplicates multiple views from the same viewer (most recent only).
 */
profilesRouter.get('/me/viewers', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const limitRaw = Number(req.query['limit'] ?? 30);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 30;

  // Resolve requesting user's profileId (rule #12)
  const [myProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, req.user!.id))
    .limit(1);

  if (!myProfile) {
    err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
    return;
  }

  const viewers = await getRecentViewers(myProfile.id, limit);
  ok(res, { viewers, total: viewers.length });
}));

// Mount content sub-router — MUST be before /:id to prevent route conflict
profilesRouter.use('/me/content', profileContentRouter);

// Mount horoscope sub-router
profilesRouter.use('/me/horoscope', horoscopeRouter);

// Mount preferences sub-router — MUST be before /:id to prevent route conflict
profilesRouter.use('/me/preferences', preferencesRouter);

// Mount community sub-router
profilesRouter.use('/me/community', communityRouter);

// Mount safety sub-router — POST /:targetUserId/safety-unlock, GET /:targetUserId/contact
profilesRouter.use('/', safetyRouter);

/**
 * GET /api/v1/profiles/:id
 * Returns another user's profile by profile UUID.
 * Phone and email are masked unless the requesting user is the profile owner.
 * Viewers with an ACCEPTED match can call GET /profiles/:targetUserId/contact
 * (handled by safetyRouter) to retrieve contact details.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

profilesRouter.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'] ?? '';

  if (!UUID_RE.test(id)) {
    err(res, 'INVALID_ID', 'Profile id must be a UUID', 400);
    return;
  }

  try {
    const profile = await getProfileById(id, req.user!.id);
    if (!profile) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found or not active', 404);
      return;
    }
    ok(res, profile);

    // Fire-and-forget view tracking (non-blocking) — rule #12: resolve userId → profileId
    (async () => {
      try {
        const [viewerProfile] = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.userId, req.user!.id))
          .limit(1);
        if (viewerProfile) {
          await trackView(viewerProfile.id, req.user!.id, id);
        }
      } catch (trackErr) {
        console.error('[profiles] trackView failed', trackErr);
      }
    })();
  } catch (e) {
    const code = (e as { code?: string } | undefined)?.code;
    if (code === '22P02') {
      err(res, 'INVALID_ID', 'Profile id must be a UUID', 400);
      return;
    }
    console.error('[profiles] GET /:id failed', e);
    err(res, 'INTERNAL_ERROR', 'Failed to load profile', 500);
  }
});
