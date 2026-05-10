/**
 * Smart Shaadi — Weddings Router
 *
 * POST   /weddings                         → createWedding
 * GET    /weddings/:id                     → getWedding
 * PUT    /weddings/:id                     → updateWedding
 * GET    /weddings/:id/tasks               → getTaskBoard
 * POST   /weddings/:id/tasks               → createTask
 * PUT    /weddings/:id/tasks/:taskId       → updateTask
 * DELETE /weddings/:id/tasks/:taskId       → deleteTask
 * GET    /weddings/:id/budget              → getBudget
 * PUT    /weddings/:id/budget              → updateBudget
 * POST   /weddings/:id/checklist/generate  → autoGenerateChecklist
 *
 * All endpoints require authenticate() middleware.
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  CreateWeddingSchema,
  UpdateWeddingSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  UpdateBudgetSchema,
  CreateCeremonySchema,
  UpdateCeremonySchema,
  SelectMuhuratSchema,
} from '@smartshaadi/schemas';
import {
  createWedding,
  getWedding,
  getBudget,
  updateWedding,
  updateBudget,
  getTaskBoard,
  createTask,
  updateTask,
  deleteTask,
  autoGenerateChecklist,
  listUserWeddings,
  addCeremony,
  updateCeremony,
  deleteCeremony,
  getCeremonies,
  selectMuhurat,
  getMuhuratSuggestions,
} from './service.js';

export const weddingRouter = Router();

// ── GET /weddings (list user's weddings) ──────────────────────────────────────

weddingRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const weddings = await listUserWeddings(req.user!.id);
      ok(res, { weddings });
    } catch (e) {
      console.error('[weddings:list]', e);
      const message = e instanceof Error ? e.message : 'Failed to list weddings';
      err(res, 'WEDDING_LIST_ERROR', message, 500);
    }
  },
);

// ── POST /weddings ─────────────────────────────────────────────────────────────

weddingRouter.post(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateWeddingSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const result = await createWedding(req.user!.id, parsed.data);
      ok(res, result, 201);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create wedding';
      if (message === 'PROFILE_NOT_FOUND') {
        err(res, 'PROFILE_NOT_FOUND', 'User profile not found', 404);
        return;
      }
      err(res, 'WEDDING_CREATE_ERROR', message, 500);
    }
  },
);

// ── GET /weddings/:id ─────────────────────────────────────────────────────────

weddingRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    try {
      const result = await getWedding(req.user!.id, id);
      if (!result) {
        err(res, 'NOT_FOUND', 'Wedding not found', 404);
        return;
      }
      ok(res, result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get wedding';
      err(res, 'WEDDING_GET_ERROR', message, 500);
    }
  },
);

// ── PUT /weddings/:id ─────────────────────────────────────────────────────────

weddingRouter.put(
  '/:id',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = UpdateWeddingSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const result = await updateWedding(req.user!.id, id, parsed.data);
      if (!result) {
        err(res, 'NOT_FOUND', 'Wedding not found', 404);
        return;
      }
      ok(res, result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update wedding';
      err(res, 'WEDDING_UPDATE_ERROR', message, 500);
    }
  },
);

// ── GET /weddings/:id/tasks ───────────────────────────────────────────────────

weddingRouter.get(
  '/:id/tasks',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    try {
      const board = await getTaskBoard(req.user!.id, id);
      if (!board) {
        err(res, 'NOT_FOUND', 'Wedding not found', 404);
        return;
      }
      ok(res, board);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get task board';
      err(res, 'TASK_BOARD_ERROR', message, 500);
    }
  },
);

// ── POST /weddings/:id/tasks ──────────────────────────────────────────────────

weddingRouter.post(
  '/:id/tasks',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const task = await createTask(req.user!.id, id, parsed.data);
      ok(res, task, 201);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create task';
      if (message === 'WEDDING_NOT_FOUND') {
        err(res, 'NOT_FOUND', 'Wedding not found', 404);
        return;
      }
      err(res, 'TASK_CREATE_ERROR', message, 500);
    }
  },
);

// ── PUT /weddings/:id/tasks/:taskId ───────────────────────────────────────────

weddingRouter.put(
  '/:id/tasks/:taskId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { id, taskId } = req.params;
    if (!id || !taskId) {
      err(res, 'VALIDATION_ERROR', 'Missing wedding id or task id', 400);
      return;
    }

    const parsed = UpdateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const task = await updateTask(req.user!.id, id, taskId, parsed.data);
      if (!task) {
        err(res, 'NOT_FOUND', 'Task not found', 404);
        return;
      }
      ok(res, task);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update task';
      err(res, 'TASK_UPDATE_ERROR', message, 500);
    }
  },
);

// ── DELETE /weddings/:id/tasks/:taskId ────────────────────────────────────────

weddingRouter.delete(
  '/:id/tasks/:taskId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { id, taskId } = req.params;
    if (!id || !taskId) {
      err(res, 'VALIDATION_ERROR', 'Missing wedding id or task id', 400);
      return;
    }

    try {
      const deleted = await deleteTask(req.user!.id, id, taskId);
      if (!deleted) {
        err(res, 'NOT_FOUND', 'Task not found', 404);
        return;
      }
      ok(res, { deleted: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete task';
      err(res, 'TASK_DELETE_ERROR', message, 500);
    }
  },
);

// ── PUT /weddings/:id/budget ──────────────────────────────────────────────────

weddingRouter.get(
  '/:id/budget',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }
    try {
      const summary = await getBudget(req.user!.id, id);
      if (!summary) { err(res, 'NOT_FOUND', 'Wedding not found', 404); return; }
      ok(res, summary);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get budget';
      err(res, 'BUDGET_GET_ERROR', message, 500);
    }
  },
);

weddingRouter.put(
  '/:id/budget',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = UpdateBudgetSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const categories = await updateBudget(req.user!.id, id, parsed.data);
      ok(res, { categories });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update budget';
      if (message === 'WEDDING_NOT_FOUND') {
        err(res, 'NOT_FOUND', 'Wedding not found', 404);
        return;
      }
      err(res, 'BUDGET_UPDATE_ERROR', message, 500);
    }
  },
);

// ── POST /weddings/:id/checklist/generate ─────────────────────────────────────

weddingRouter.post(
  '/:id/checklist/generate',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const { weddingDate } = req.body as { weddingDate?: unknown };
    if (typeof weddingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weddingDate)) {
      err(res, 'VALIDATION_ERROR', 'weddingDate must be a YYYY-MM-DD string', 400);
      return;
    }

    try {
      const result = await autoGenerateChecklist(req.user!.id, id, weddingDate);
      ok(res, result, 201);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to generate checklist';
      if (message === 'WEDDING_NOT_FOUND') {
        err(res, 'NOT_FOUND', 'Wedding not found', 404);
        return;
      }
      err(res, 'CHECKLIST_GENERATE_ERROR', message, 500);
    }
  },
);

// ── GET /weddings/:id/ceremonies ──────────────────────────────────────────────

weddingRouter.get(
  '/:id/ceremonies',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    try {
      const result = await getCeremonies(req.user!.id, id);
      ok(res, { ceremonies: result });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get ceremonies';
      if (message === 'WEDDING_NOT_FOUND') {
        err(res, 'NOT_FOUND', 'Wedding not found', 404); return;
      }
      err(res, 'CEREMONIES_GET_ERROR', message, 500);
    }
  },
);

// ── POST /weddings/:id/ceremonies ─────────────────────────────────────────────

weddingRouter.post(
  '/:id/ceremonies',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = CreateCeremonySchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const ceremony = await addCeremony(req.user!.id, id, parsed.data);
      ok(res, ceremony, 201);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to add ceremony';
      if (message === 'WEDDING_NOT_FOUND') {
        err(res, 'NOT_FOUND', 'Wedding not found', 404); return;
      }
      err(res, 'CEREMONY_CREATE_ERROR', message, 500);
    }
  },
);

// ── PUT /weddings/:id/ceremonies/:cId ─────────────────────────────────────────

weddingRouter.put(
  '/:id/ceremonies/:cId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { id, cId } = req.params;
    if (!id || !cId) {
      err(res, 'VALIDATION_ERROR', 'Missing wedding id or ceremony id', 400); return;
    }

    const parsed = UpdateCeremonySchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const ceremony = await updateCeremony(req.user!.id, id, cId, parsed.data);
      if (!ceremony) {
        err(res, 'NOT_FOUND', 'Ceremony not found', 404); return;
      }
      ok(res, ceremony);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update ceremony';
      if (message === 'WEDDING_NOT_FOUND') {
        err(res, 'NOT_FOUND', 'Wedding not found', 404); return;
      }
      err(res, 'CEREMONY_UPDATE_ERROR', message, 500);
    }
  },
);

// ── DELETE /weddings/:id/ceremonies/:cId ──────────────────────────────────────

weddingRouter.delete(
  '/:id/ceremonies/:cId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { id, cId } = req.params;
    if (!id || !cId) {
      err(res, 'VALIDATION_ERROR', 'Missing wedding id or ceremony id', 400); return;
    }

    try {
      const deleted = await deleteCeremony(req.user!.id, id, cId);
      if (!deleted) {
        err(res, 'NOT_FOUND', 'Ceremony not found', 404); return;
      }
      ok(res, { deleted: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete ceremony';
      err(res, 'CEREMONY_DELETE_ERROR', message, 500);
    }
  },
);

// ── GET /weddings/:id/muhurat ─────────────────────────────────────────────────

weddingRouter.get(
  '/:id/muhurat',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    try {
      // Derive weddingDate from the wedding record
      const wedding = await getWedding(req.user!.id, id);
      if (!wedding) {
        err(res, 'NOT_FOUND', 'Wedding not found', 404); return;
      }
      const suggestions = getMuhuratSuggestions(wedding.weddingDate ?? new Date().toISOString().slice(0, 10));
      ok(res, { suggestions });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get muhurat suggestions';
      err(res, 'MUHURAT_GET_ERROR', message, 500);
    }
  },
);

// ── PUT /weddings/:id/muhurat ─────────────────────────────────────────────────

weddingRouter.put(
  '/:id/muhurat',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'];
    if (!id) { err(res, 'VALIDATION_ERROR', 'Missing wedding id', 400); return; }

    const parsed = SelectMuhuratSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
      return;
    }

    try {
      const dates = await selectMuhurat(req.user!.id, id, parsed.data);
      ok(res, { muhuratDates: dates });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to select muhurat';
      if (message === 'WEDDING_NOT_FOUND') {
        err(res, 'NOT_FOUND', 'Wedding not found', 404); return;
      }
      err(res, 'MUHURAT_SELECT_ERROR', message, 500);
    }
  },
);

// ── FAQ (Function Attendance Quotient) endpoints ──────────────────────────────

import { redis } from '../lib/redis.js';
import { requireRole } from './access.js';
import { extract, extractAllForWedding } from '../services/faqFeatures.js';
import { predictBatch } from '../services/faqService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── GET /weddings/:weddingId/ceremonies/:ceremonyId/faq ───────────────────────

weddingRouter.get(
  '/:weddingId/ceremonies/:ceremonyId/faq',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { weddingId, ceremonyId } = req.params;
    if (!weddingId || !ceremonyId) {
      err(res, 'VALIDATION_ERROR', 'Missing weddingId or ceremonyId', 400); return;
    }

    const userId = req.user!.id;

    // Access check
    try {
      await requireRole(weddingId, userId, 'ANY');
    } catch (e) {
      const appErr = e as { code?: string; status?: number; message?: string };
      err(res, appErr.code ?? 'FORBIDDEN', appErr.message ?? 'Forbidden', appErr.status ?? 403);
      return;
    }

    // UUID validation
    if (!UUID_RE.test(weddingId) || !UUID_RE.test(ceremonyId)) {
      err(res, 'VALIDATION_ERROR', 'Invalid UUID format', 400); return;
    }

    // Rate limit: 30 requests per user per hour
    const rlKey = `faq:rl:${userId}`;
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, 3600);
    if (count > 30) {
      err(res, 'RATE_LIMITED', 'Too many FAQ requests', 429); return;
    }

    // Cache check
    const cacheKey = `faq:wedding:${weddingId}:ceremony:${ceremonyId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      ok(res, JSON.parse(cached) as Record<string, unknown>); return;
    }

    // Extract features + predict
    const items = await extract(weddingId, ceremonyId);

    if (items.length === 0) {
      err(res, 'NOT_FOUND', 'Ceremony not found or has no invited guests', 404); return;
    }

    const predictions = await predictBatch(items);

    // Build counts for confidence bands
    let high = 0, medium = 0, low = 0;
    let expectedAttendance = 0;

    for (const p of predictions) {
      expectedAttendance += p.predictedProbability;
      if (p.confidenceBand === 'high')   high++;
      else if (p.confidenceBand === 'medium') medium++;
      else low++;
    }

    // Determine ceremony_type from first item (all rows share the same ceremony)
    const ceremonyType = items[0]?.input.ceremony_type ?? 'wedding';

    const payload = {
      ceremony_id:   ceremonyId,
      ceremony_type: ceremonyType,
      total_invited: predictions.length,
      predictions: predictions.map((p) => ({
        guest_id:              p.guestId,
        guest_name:            items.find((i) => i.guestId === p.guestId)?.guestName ?? '',
        predicted_probability: p.predictedProbability,
        confidence_band:       p.confidenceBand,
        direction:             p.direction,
        rsvp_response:         p.rsvpResponse,
      })),
      summary: {
        expected_attendance:    expectedAttendance,
        high_confidence_count:  high,
        medium_confidence_count: medium,
        low_confidence_count:   low,
      },
    };

    await redis.set(cacheKey, JSON.stringify(payload), 'EX', 3600);
    ok(res, payload);
  },
);

// ── GET /weddings/:weddingId/faq/summary ─────────────────────────────────────

weddingRouter.get(
  '/:weddingId/faq/summary',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { weddingId } = req.params;
    if (!weddingId) {
      err(res, 'VALIDATION_ERROR', 'Missing weddingId', 400); return;
    }

    const userId = req.user!.id;

    // Access check
    try {
      await requireRole(weddingId, userId, 'ANY');
    } catch (e) {
      const appErr = e as { code?: string; status?: number; message?: string };
      err(res, appErr.code ?? 'FORBIDDEN', appErr.message ?? 'Forbidden', appErr.status ?? 403);
      return;
    }

    // UUID validation
    if (!UUID_RE.test(weddingId)) {
      err(res, 'VALIDATION_ERROR', 'Invalid UUID format', 400); return;
    }

    // Rate limit: 30 requests per user per hour (shared with per-ceremony endpoint)
    const rlKey = `faq:rl:${userId}`;
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, 3600);
    if (count > 30) {
      err(res, 'RATE_LIMITED', 'Too many FAQ requests', 429); return;
    }

    // Cache check
    const cacheKey = `faq:wedding:${weddingId}:summary`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      ok(res, JSON.parse(cached) as Record<string, unknown>); return;
    }

    // Extract all ceremonies for wedding
    const ceremoniesMap = await extractAllForWedding(weddingId);

    const ceremonySummaries: Array<{
      ceremony_id:              string;
      ceremony_type:            string;
      total_invited:            number;
      expected_attendance:      number;
      estimated_catering_count: number;
    }> = [];

    for (const [cId, rows] of ceremoniesMap.entries()) {
      if (rows.length === 0) continue;

      const preds = await predictBatch(rows);

      const expectedAttendance = preds.reduce(
        (sum, p) => sum + p.predictedProbability,
        0,
      );

      ceremonySummaries.push({
        ceremony_id:              cId,
        ceremony_type:            rows[0]?.input.ceremony_type ?? 'wedding',
        total_invited:            preds.length,
        expected_attendance:      expectedAttendance,
        estimated_catering_count: Math.ceil(expectedAttendance * 1.1),
      });
    }

    const payload = {
      wedding_id: weddingId,
      ceremonies: ceremonySummaries,
    };

    await redis.set(cacheKey, JSON.stringify(payload), 'EX', 3600);
    ok(res, payload);
  },
);
