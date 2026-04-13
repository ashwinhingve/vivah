import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  getMyProfile,
  updateMyProfile,
  getProfileById,
} from './service.js';

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
