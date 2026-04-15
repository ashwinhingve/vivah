// apps/api/src/profiles/preferences.router.ts

import { Router, type Request, type Response } from 'express';
import { UpdatePartnerPreferencesSchema } from '@smartshaadi/schemas';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { getPartnerPreferences, updatePartnerPreferences } from './preferences.service.js';

export const preferencesRouter = Router();

/**
 * GET /api/v1/profiles/me/preferences
 */
preferencesRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const data = await getPartnerPreferences(req.user!.id);
    ok(res, data);
  },
);

/**
 * PUT /api/v1/profiles/me/preferences
 */
preferencesRouter.put(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdatePartnerPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const data = await updatePartnerPreferences(req.user!.id, parsed.data);
    ok(res, data);
  },
);
