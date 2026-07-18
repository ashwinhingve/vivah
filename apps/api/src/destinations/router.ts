/**
 * Smart Shaadi — Destination Wedding Router (Phase 8 Sprint I, Unit 8.1)
 *
 * Mounted at /api/v1/weddings/:weddingId/destinations (mergeParams: true).
 *
 *   GET    /                    list legs                    VIEWER
 *   POST   /                    create a leg                 EDITOR
 *   POST   /reorder             reorder legs                 EDITOR
 *   GET    /:id                 leg detail                   VIEWER
 *   PUT    /:id                 update a leg                 EDITOR
 *   DELETE /:id                 delete a leg                 EDITOR
 *   POST   /:id/set-primary     move the primary flag        EDITOR
 *   GET    /:id/travel          list guest travel            VIEWER
 *   PUT    /:id/travel          upsert one guest's travel    EDITOR
 *   DELETE /:id/travel/:legId   remove a travel record       EDITOR
 *
 * `/reorder` is declared BEFORE `/:id` — Express matches in declaration order, so
 * the reverse would let the param route swallow it and then reject "reorder" as a
 * malformed uuid.
 *
 * Validation uses the FROZEN Zod schemas from '@smartshaadi/schemas'. Redefining
 * them here would let the API drift from what the web Server Actions post.
 *
 * Standard { success, data, error, meta } envelope throughout via ok/err.
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { requireRole } from '../weddings/access.js';
import { registerUuidParams } from '../middleware/validateUuidParams.js';
import {
  CreateDestinationSchema,
  UpdateDestinationSchema,
  UpsertGuestTravelLegSchema,
  ReorderDestinationsSchema,
} from '@smartshaadi/schemas';
import {
  listDestinations,
  createDestination,
  getDestinationDetail,
  updateDestination,
  deleteDestination,
  setPrimaryDestination,
  reorderDestinations,
  listTravelLegs,
  upsertGuestTravelLeg,
  deleteGuestTravelLeg,
  DestinationError,
} from './service.js';

export const destinationsRouter: Router = Router({ mergeParams: true });

registerUuidParams(destinationsRouter, 'weddingId', 'id', 'legId');

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND:            404,
  FORBIDDEN:            403,
  GUEST_NOT_IN_WEDDING: 404,
  INVALID_DATE_RANGE:   400,
  DUPLICATE_PRIMARY:    409,
  VALIDATION_ERROR:     400,
  INTERNAL_ERROR:       500,
};

/**
 * `requireRole` throws a plain Error decorated with { code, status } rather than
 * a DestinationError, so both shapes are handled here. Anything else is a genuine
 * bug and becomes a 500 — it is not reshaped into a friendlier 4xx.
 */
function handleError(res: Response, e: unknown): void {
  if (e instanceof DestinationError) {
    err(res, e.code, e.message, STATUS_BY_CODE[e.code] ?? 400);
    return;
  }
  if (typeof e === 'object' && e !== null && 'code' in e && 'status' in e) {
    const { code, status } = e as { code: unknown; status: unknown };
    if (typeof code === 'string' && typeof status === 'number') {
      err(res, code, e instanceof Error ? e.message : 'Request failed', status);
      return;
    }
  }
  const message = e instanceof Error ? e.message : 'Unexpected error';
  err(res, 'INTERNAL_ERROR', message, 500);
}

/** The weddingId is validated as a uuid by registerUuidParams before we get here. */
function weddingIdOf(req: Request): string {
  return req.params['weddingId'] ?? '';
}

// ── Collection ───────────────────────────────────────────────────────────────

destinationsRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'VIEWER');
    ok(res, { destinations: await listDestinations(weddingId) });
  } catch (e) {
    handleError(res, e);
  }
});

destinationsRouter.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'EDITOR');

    const parsed = CreateDestinationSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    ok(res, { destination: await createDestination(weddingId, parsed.data) }, 201);
  } catch (e) {
    handleError(res, e);
  }
});

// Declared before '/:id' on purpose — see the header note.
destinationsRouter.post('/reorder', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'EDITOR');

    const parsed = ReorderDestinationsSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    ok(res, { destinations: await reorderDestinations(weddingId, parsed.data) });
  } catch (e) {
    handleError(res, e);
  }
});

// ── Single leg ───────────────────────────────────────────────────────────────

destinationsRouter.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'VIEWER');
    ok(res, await getDestinationDetail(weddingId, req.params['id']!));
  } catch (e) {
    handleError(res, e);
  }
});

destinationsRouter.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'EDITOR');

    const parsed = UpdateDestinationSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    ok(res, { destination: await updateDestination(weddingId, req.params['id']!, parsed.data) });
  } catch (e) {
    handleError(res, e);
  }
});

destinationsRouter.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'EDITOR');
    ok(res, await deleteDestination(weddingId, req.params['id']!));
  } catch (e) {
    handleError(res, e);
  }
});

destinationsRouter.post('/:id/set-primary', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'EDITOR');
    ok(res, { destination: await setPrimaryDestination(weddingId, req.params['id']!) });
  } catch (e) {
    handleError(res, e);
  }
});

// ── Guest travel ─────────────────────────────────────────────────────────────

destinationsRouter.get('/:id/travel', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'VIEWER');
    ok(res, { travel: await listTravelLegs(weddingId, req.params['id']!) });
  } catch (e) {
    handleError(res, e);
  }
});

destinationsRouter.put('/:id/travel', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'EDITOR');

    const parsed = UpsertGuestTravelLegSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }
    ok(res, { travel: await upsertGuestTravelLeg(weddingId, req.params['id']!, parsed.data) });
  } catch (e) {
    handleError(res, e);
  }
});

destinationsRouter.delete('/:id/travel/:legId', authenticate, async (req: Request, res: Response) => {
  try {
    const weddingId = weddingIdOf(req);
    await requireRole(weddingId, req.user!.id, 'EDITOR');
    ok(res, await deleteGuestTravelLeg(weddingId, req.params['id']!, req.params['legId']!));
  } catch (e) {
    handleError(res, e);
  }
});
