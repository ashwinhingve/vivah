/**
 * Smart Shaadi — Coordinator router
 *
 * Endpoints under /coordinator/* for the EVENT_COORDINATOR persona.
 * Endpoints under /weddings/:id/coordinators for owner management.
 */

import { Router, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { AssignCoordinatorSchema } from '@smartshaadi/schemas';
import * as coordinator from './coordinator.service.js';

interface AppError extends Error { code?: string; status?: number; }

function handle(res: Response, e: unknown, fallback: string): void {
  const ae = e as AppError;
  const code = ae.code ?? fallback;
  const status = ae.status ?? 500;
  err(res, code, ae instanceof Error ? ae.message : 'Unknown', status);
}

// ── /coordinator/* — coordinator-scoped routes ───────────────────────────────

export const coordinatorRouter = Router();

coordinatorRouter.get('/weddings', authenticate, async (req, res) => {
  try { ok(res, { weddings: await coordinator.listMyManagedWeddings(req.user!.id) }); }
  catch (e) { handle(res, e, 'COORD_LIST_ERROR'); }
});

// ── /weddings/:id/coordinators — owner-managed assignments ───────────────────

export const weddingCoordinatorRouter = Router({ mergeParams: true });

weddingCoordinatorRouter.get('/:id/coordinators', authenticate, async (req, res) => {
  try { ok(res, { coordinators: await coordinator.listCoordinatorsForWedding(req.params['id']!, req.user!.id) }); }
  catch (e) { handle(res, e, 'COORD_GET_ERROR'); }
});

weddingCoordinatorRouter.post('/:id/coordinators', authenticate, async (req, res) => {
  const parsed = AssignCoordinatorSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await coordinator.assignCoordinator(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'COORD_ASSIGN_ERROR'); }
});

weddingCoordinatorRouter.delete('/:id/coordinators/:userId', authenticate, async (req, res) => {
  try {
    await coordinator.revokeCoordinator(req.params['id']!, req.user!.id, req.params['userId']!);
    ok(res, { revoked: true });
  } catch (e) { handle(res, e, 'COORD_REVOKE_ERROR'); }
});
