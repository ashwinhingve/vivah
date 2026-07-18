/**
 * Admin churn-recovery router (Unit 7.3).
 *
 * Mount in index.ts: app.use('/api/v1/admin/retention', retentionRouter)
 *
 *   GET /api/v1/admin/retention/campaigns   — paginated attempts + outcomes
 *   GET /api/v1/admin/retention/stats        — counts + conversion rate
 *
 * ADMIN session required. Read-only surface over the sweep's output.
 */
import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { logger } from '../lib/logger.js';
import { RetentionCampaignsQuerySchema } from '@smartshaadi/schemas';
import { listCampaigns, getStats } from './service.js';

export const retentionRouter = Router();

retentionRouter.get(
  '/campaigns',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = RetentionCampaignsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      err(res, 'BAD_REQUEST', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
      return;
    }
    try {
      const result = await listCampaigns(parsed.data);
      ok(res, result);
    } catch (e) {
      logger.error({ err: e }, 'retention_campaigns_list_failed');
      err(res, 'INTERNAL_ERROR', 'Failed to list retention campaigns', 500);
    }
  },
);

retentionRouter.get(
  '/stats',
  authenticate,
  authorize(['ADMIN']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = await getStats();
      ok(res, stats);
    } catch (e) {
      logger.error({ err: e }, 'retention_stats_failed');
      err(res, 'INTERNAL_ERROR', 'Failed to compute retention stats', 500);
    }
  },
);
