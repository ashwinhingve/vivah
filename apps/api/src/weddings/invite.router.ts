/**
 * Public (unauthenticated) e-invite endpoints — contract Item 16.
 *
 * Mounted at /api/v1/invites. NO authenticate middleware: a guest views the
 * invite and RSVPs via the unguessable slug, no login required.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ok, err } from '../lib/response.js';
import {
  getPublicInvite, submitPublicInviteRsvp, InviteError,
} from './invite.service.js';

export const invitesPublicRouter = Router();

const RsvpSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(15).optional(),
  email: z.string().email().max(255).optional(),
  attending: z.enum(['YES', 'NO', 'MAYBE']),
  plusOnes: z.number().int().min(0).max(20).optional(),
  mealPreference: z.string().max(40).optional(),
  message: z.string().max(1000).optional(),
});

invitesPublicRouter.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  const view = await getPublicInvite(req.params['slug']!);
  if (!view) {
    err(res, 'NOT_FOUND', 'Invite not found', 404);
    return;
  }
  ok(res, view);
});

invitesPublicRouter.post('/:slug/rsvp', async (req: Request, res: Response): Promise<void> => {
  const parsed = RsvpSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400);
    return;
  }
  try {
    const result = await submitPublicInviteRsvp(req.params['slug']!, parsed.data);
    ok(res, result);
  } catch (e) {
    if (e instanceof InviteError) {
      const status = e.code === 'NOT_FOUND' ? 404 : e.code === 'RATE_LIMITED' ? 429 : 400;
      err(res, e.code, e.message, status);
      return;
    }
    throw e;
  }
});
