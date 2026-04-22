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
