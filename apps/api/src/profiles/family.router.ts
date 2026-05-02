/**
 * Smart Shaadi — Family Router
 *
 * GET    /api/v1/profiles/me/family                       → composite view
 * GET    /api/v1/profiles/me/family/members               → list family_members
 * POST   /api/v1/profiles/me/family/members               → add family member
 * PUT    /api/v1/profiles/me/family/members/:memberId     → update
 * DELETE /api/v1/profiles/me/family/members/:memberId     → remove
 * GET    /api/v1/profiles/me/family/verification          → badge status
 * POST   /api/v1/profiles/me/family/verification/request  → request verification
 * POST   /api/v1/profiles/me/family/recompute-score       → recompute inclination
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  AddFamilyMemberSchema, UpdateFamilyMemberSchema,
} from '@smartshaadi/schemas';
import {
  listFamilyMembers, addFamilyMember, updateFamilyMember, removeFamilyMember,
  getFamilyVerification, requestFamilyVerification,
  computeFamilyInclinationScore, getFamilyView,
} from './family.service.js';

export const familyRouter = Router();

interface AppError extends Error { code?: string; status?: number; }

function handleError(res: Response, e: unknown, fallback: string): void {
  const ae = e as AppError;
  const status = ae.status ?? 500;
  const code   = ae.code   ?? 'INTERNAL_ERROR';
  const msg    = ae instanceof Error ? ae.message : fallback;
  if (status === 403) { err(res, 'FORBIDDEN', msg, 403); return; }
  if (status === 404) { err(res, 'NOT_FOUND', msg, 404); return; }
  err(res, code, msg, status);
}

familyRouter.get(
  '/family',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const view = await getFamilyView(req.user!.id);
      ok(res, view);
    } catch (e) { handleError(res, e, 'Failed to load family view'); }
  },
);

familyRouter.get(
  '/family/members',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const members = await listFamilyMembers(req.user!.id);
      ok(res, { members });
    } catch (e) { handleError(res, e, 'Failed to list family members'); }
  },
);

familyRouter.post(
  '/family/members',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = AddFamilyMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const m = await addFamilyMember(req.user!.id, parsed.data);
      ok(res, m, 201);
    } catch (e) { handleError(res, e, 'Failed to add family member'); }
  },
);

familyRouter.put(
  '/family/members/:memberId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const memberId = req.params['memberId'];
    if (!memberId) { err(res, 'VALIDATION_ERROR', 'Missing member id', 400); return; }
    const parsed = UpdateFamilyMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    try {
      const m = await updateFamilyMember(req.user!.id, memberId, parsed.data);
      ok(res, m);
    } catch (e) { handleError(res, e, 'Failed to update family member'); }
  },
);

familyRouter.delete(
  '/family/members/:memberId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const memberId = req.params['memberId'];
    if (!memberId) { err(res, 'VALIDATION_ERROR', 'Missing member id', 400); return; }
    try {
      await removeFamilyMember(req.user!.id, memberId);
      ok(res, { deleted: true });
    } catch (e) { handleError(res, e, 'Failed to remove family member'); }
  },
);

familyRouter.get(
  '/family/verification',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const v = await getFamilyVerification(req.user!.id);
      ok(res, v);
    } catch (e) { handleError(res, e, 'Failed to fetch verification'); }
  },
);

familyRouter.post(
  '/family/verification/request',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const v = await requestFamilyVerification(req.user!.id);
      ok(res, v);
    } catch (e) { handleError(res, e, 'Failed to request verification'); }
  },
);

familyRouter.post(
  '/family/recompute-score',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const score = await computeFamilyInclinationScore(req.user!.id);
      ok(res, { familyInclinationScore: score });
    } catch (e) { handleError(res, e, 'Failed to recompute score'); }
  },
);
