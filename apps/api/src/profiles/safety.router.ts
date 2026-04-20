import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { requestContactUnlock, getContactIfVisible, updateSafetyMode } from './safety.service.js';

export const safetyRouter = Router();

const SafetyModeSchema = z.object({
  contactHidden: z.boolean().optional(),
  photoHidden:   z.boolean().optional(),
  incognito:     z.boolean().optional(),
});

/**
 * PUT /api/v1/profiles/me/safety-mode
 * Update the authenticated user's own safety-mode preferences in MongoDB ProfileContent.
 */
safetyRouter.put(
  '/me/safety-mode',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = SafetyModeSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const updated = await updateSafetyMode(req.user!.id, parsed.data);
    ok(res, updated);
  },
);

/**
 * POST /api/v1/profiles/:targetUserId/safety-unlock
 * Request to unlock contact details for a matched profile.
 * Requires an ACCEPTED match between the two profiles.
 */
safetyRouter.post(
  '/:targetUserId/safety-unlock',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const targetUserId = req.params['targetUserId'];
    if (!targetUserId) {
      err(res, 'INVALID_PARAMS', 'targetUserId is required', 400);
      return;
    }

    const result = await requestContactUnlock(req.user!.id, targetUserId);

    if (!result.success) {
      err(res, 'SAFETY_UNLOCK_FAILED', result.reason ?? 'Cannot unlock contact', 400);
      return;
    }

    ok(res, { unlockedAt: new Date().toISOString() }, 201);
  },
);

/**
 * GET /api/v1/profiles/:targetUserId/contact
 * Returns phone and email for a profile if the requester is allowed to view them.
 * Respects safetyMode.contactHidden and safetyModeUnlocks table.
 */
safetyRouter.get(
  '/:targetUserId/contact',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const targetUserId = req.params['targetUserId'];
    if (!targetUserId) {
      err(res, 'INVALID_PARAMS', 'targetUserId is required', 400);
      return;
    }

    const contact = await getContactIfVisible(req.user!.id, targetUserId);

    if (!contact) {
      err(res, 'CONTACT_HIDDEN', 'Contact details are hidden for this profile', 403);
      return;
    }

    ok(res, contact);
  },
);
