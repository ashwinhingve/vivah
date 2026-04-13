import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  getMyProfile,
  updateMyProfile,
  getProfileById,
  addProfilePhoto,
  deleteProfilePhoto,
} from './service.js';
import { profileContentRouter } from './content.router.js';

export const profilesRouter = Router();

/**
 * GET /api/v1/profiles/me
 * Returns the authenticated user's own profile (full contact visible).
 * Creates a profile row automatically on first call.
 */
profilesRouter.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const profile = await getMyProfile(req.user!.id);
  if (!profile) {
    err(res, 'USER_NOT_FOUND', 'User not found', 404);
    return;
  }
  ok(res, profile);
});

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
profilesRouter.put('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
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
});

/**
 * POST /api/v1/profiles/me/photos
 * Records a photo that was already uploaded directly to R2 via pre-signed URL.
 * Body: { r2Key, isPrimary?, displayOrder? }
 */
const AddPhotoSchema = z.object({
  r2Key:        z.string().min(1),
  isPrimary:    z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

profilesRouter.post('/me/photos', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = AddPhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }

  const input: import('./service.js').AddPhotoInput = { r2Key: parsed.data.r2Key };
  if (parsed.data.isPrimary    != null) input.isPrimary    = parsed.data.isPrimary;
  if (parsed.data.displayOrder != null) input.displayOrder = parsed.data.displayOrder;

  const photo = await addProfilePhoto(req.user!.id, input);
  if (!photo) {
    err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
    return;
  }
  ok(res, photo, 201);
});

/**
 * DELETE /api/v1/profiles/me/photos/:photoId
 * Removes a photo record by photo UUID (does not delete from R2 — caller handles that).
 */
profilesRouter.delete('/me/photos/:photoId', authenticate, async (req: Request, res: Response): Promise<void> => {
  const photoId = req.params['photoId'] ?? '';

  const deleted = await deleteProfilePhoto(req.user!.id, photoId);
  if (!deleted) {
    err(res, 'PHOTO_NOT_FOUND', 'Photo not found or not owned by this user', 404);
    return;
  }
  ok(res, { deleted: true });
});

// Mount content sub-router — MUST be before /:id to prevent route conflict
profilesRouter.use('/me/content', profileContentRouter);

/**
 * GET /api/v1/profiles/:id
 * Returns another user's profile by profile UUID.
 * Phone and email are masked unless the requesting user is the profile owner.
 * TODO: Expose contact when safety_mode_unlocks is added to schema.
 */
profilesRouter.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'] ?? '';

  const profile = await getProfileById(id, req.user!.id);
  if (!profile) {
    err(res, 'PROFILE_NOT_FOUND', 'Profile not found or not active', 404);
    return;
  }
  ok(res, profile);
});
