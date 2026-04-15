// apps/api/src/profiles/community.router.ts

import { Router, type Request, type Response } from 'express';
import { UpdateCommunityZoneSchema } from '@smartshaadi/schemas';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { getCommunityZone, updateCommunityZone } from './community.service.js';

export const communityRouter = Router();

/**
 * GET /api/v1/profiles/me/community
 */
communityRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const data = await getCommunityZone(req.user!.id);
    ok(res, data);
  },
);

/**
 * PUT /api/v1/profiles/me/community
 */
communityRouter.put(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateCommunityZoneSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    const data = await updateCommunityZone(req.user!.id, parsed.data);
    if (!data) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }
    ok(res, data);
  },
);
