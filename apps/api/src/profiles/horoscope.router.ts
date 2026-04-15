// apps/api/src/profiles/horoscope.router.ts

import { Router, type Request, type Response } from 'express';
import { UpdateHoroscopeSchema } from '@smartshaadi/schemas';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { updateHoroscope, getHoroscope } from './horoscope.service.js';

export const horoscopeRouter = Router();

/**
 * GET /api/v1/profiles/me/horoscope
 */
horoscopeRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const data = await getHoroscope(req.user!.id);
    ok(res, data);
  },
);

/**
 * PUT /api/v1/profiles/me/horoscope
 */
horoscopeRouter.put(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateHoroscopeSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    const content = await updateHoroscope(req.user!.id, parsed.data);
    ok(res, content);
  },
);
