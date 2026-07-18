/**
 * Smart Shaadi — NRI / international profile routes
 * apps/api/src/profiles/nri.router.ts
 *
 * Phase 7 Sprint G (Unit 7.2), Phase 2 integration.
 * Mounted at /api/v1/profiles/me/nri — see profiles/router.ts.
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { UpdateNriProfileSchema } from '@smartshaadi/schemas';
import { getNriProfile, updateNriProfile, NriServiceError } from './nri.service.js';

export const nriRouter: Router = Router();

nriRouter.get('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return err(res, 'UNAUTHORIZED', 'Not authenticated', 401);

  try {
    return ok(res, await getNriProfile(userId));
  } catch (e) {
    if (e instanceof NriServiceError) return err(res, e.code, e.message, e.status);
    console.error('[nri.router] GET failed:', e);
    return err(res, 'INTERNAL_ERROR', 'Failed to load NRI profile', 500);
  }
});

nriRouter.put('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return err(res, 'UNAUTHORIZED', 'Not authenticated', 401);

  const parsed = UpdateNriProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
  }

  try {
    return ok(res, await updateNriProfile(userId, parsed.data));
  } catch (e) {
    if (e instanceof NriServiceError) return err(res, e.code, e.message, e.status);
    console.error('[nri.router] PUT failed:', e);
    return err(res, 'INTERNAL_ERROR', 'Failed to update NRI profile', 500);
  }
});
