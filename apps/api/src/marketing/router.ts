/**
 * Smart Shaadi — Marketing Admin Router (Unit 6.4, Sprint J)
 *
 * Admin endpoints for campaign CRUD, transitions, and send listing.
 * All routes require ADMIN role.
 */

import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { campaignSends } from '@smartshaadi/db';
import {
  createCampaign,
  updateCampaign,
  getCampaign,
  listCampaigns,
  approveCampaign,
  activateCampaign,
  pauseCampaign,
  resumeCampaign,
  completeCampaign,
  getOverviewStats,
} from './service.js';
import { CreateMarketingCampaignSchema, UpdateMarketingCampaignSchema, CampaignTransitionSchema, MarketingCampaignsQuerySchema, CampaignSendsQuerySchema } from '@smartshaadi/schemas';
import { authorize } from '../auth/middleware.js';

export const marketingRouter = Router();

// Middleware: all routes require ADMIN
marketingRouter.use(authorize(['ADMIN']));

/**
 * GET /api/v1/admin/marketing
 * List campaigns with stats
 */
marketingRouter.get('/', async (req: Request, res: Response) => {
  try {
    const query = MarketingCampaignsQuerySchema.parse(req.query);
    type ListInputType = Parameters<typeof listCampaigns>[0];
    const listInput: ListInputType = {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      ...(query.status !== undefined && { status: query.status }),
    };
    const result = await listCampaigns(listInput);

    res.json({
      success: true,
      data: result,
      meta: { total: result.total },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message },
      });
    }
    logger.error({ err }, 'marketing_list_error');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /api/v1/admin/marketing/overview
 * Platform-wide KPI strip
 */
marketingRouter.get('/overview', async (_req: Request, res: Response) => {
  try {
    const stats = await getOverviewStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error({ err }, 'marketing_overview_error');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
  }
});

/**
 * POST /api/v1/admin/marketing
 * Create new campaign (DRAFT)
 */
marketingRouter.post('/', async (req: Request, res: Response) => {
  try {
    const input = CreateMarketingCampaignSchema.parse(req.body);
    const userId = req.user!.id;
    type CreateInputType = Parameters<typeof createCampaign>[0];
    const createInput: CreateInputType = {
      name: input.name,
      triggerType: input.triggerType,
      segmentKey: input.segmentKey,
      templateKey: input.templateKey,
      createdByUserId: userId,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.channelSet !== undefined && { channelSet: input.channelSet }),
      ...(input.scheduleConfig !== undefined && { scheduleConfig: input.scheduleConfig }),
      ...(input.eventHookKey !== undefined && { eventHookKey: input.eventHookKey }),
      ...(input.frequencyCapPerWeek !== undefined && { frequencyCapPerWeek: input.frequencyCapPerWeek }),
      ...(input.conversionGoal !== undefined && { conversionGoal: input.conversionGoal }),
      ...(input.attributionWindowDays !== undefined && { attributionWindowDays: input.attributionWindowDays }),
    };
    const campaign = await createCampaign(createInput);

    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message },
      });
    }
    logger.error({ err }, 'marketing_create_error');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /api/v1/admin/marketing/:id
 * Fetch campaign with stats
 */
marketingRouter.get('/:id', async (req: Request, res: Response) => {
  const campaignId = req.params.id as string;
  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Campaign not found' },
      });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    logger.error({ err, campaignId: campaignId }, 'marketing_get_error');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
  }
});

/**
 * PATCH /api/v1/admin/marketing/:id
 * Update campaign (only DRAFT/PAUSED)
 */
marketingRouter.patch('/:id', async (req: Request, res: Response) => {
  const campaignId = req.params.id as string;
  try {
    const input = UpdateMarketingCampaignSchema.parse(req.body);
    const updateInput: Record<string, unknown> = {};
    if (input.name !== undefined) updateInput.name = input.name;
    if (input.description !== undefined) updateInput.description = input.description;
    if (input.channelSet !== undefined) updateInput.channelSet = input.channelSet;
    if (input.scheduleConfig !== undefined) updateInput.scheduleConfig = input.scheduleConfig;
    if (input.frequencyCapPerWeek !== undefined) updateInput.frequencyCapPerWeek = input.frequencyCapPerWeek;
    if (input.conversionGoal !== undefined) updateInput.conversionGoal = input.conversionGoal;
    if (input.attributionWindowDays !== undefined) updateInput.attributionWindowDays = input.attributionWindowDays;
    const campaign = await updateCampaign(campaignId, updateInput as Parameters<typeof updateCampaign>[1]);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Campaign not found' },
      });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    const error = err as unknown;
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }
    if (error instanceof Error && error.message.includes('Cannot edit')) {
      return res.status(409).json({
        success: false,
        error: { code: 'INVALID_STATE', message: error.message },
      });
    }
    logger.error({ err, campaignId: campaignId }, 'marketing_update_error');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
  }
});

/**
 * POST /api/v1/admin/marketing/:id/transition
 * Trigger state transition (approve, activate, pause, resume, complete)
 */
marketingRouter.post('/:id/transition', async (req: Request, res: Response) => {
  const campaignId = req.params.id as string;
  try {
    const input = CampaignTransitionSchema.parse(req.body);
    const userId = req.user!.id;
    let campaign;

    try {
      switch (input.action) {
        case 'approve':
          campaign = await approveCampaign(campaignId, userId);
          break;
        case 'activate':
          campaign = await activateCampaign(campaignId);
          break;
        case 'pause':
          campaign = await pauseCampaign(campaignId);
          break;
        case 'resume':
          campaign = await resumeCampaign(campaignId);
          break;
        case 'complete':
          campaign = await completeCampaign(campaignId);
          break;
        default:
          const _exhaustive: never = input.action;
          throw new Error(`Unknown action: ${_exhaustive}`);
      }
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          error: { code: 'TRANSITION_FAILED', message: err.message },
        });
      }
      throw e;
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message },
      });
    }
    logger.error({ err, campaignId: campaignId }, 'marketing_transition_error');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
  }
});

/**
 * GET /api/v1/admin/marketing/:id/sends
 * List sends for a campaign
 */
marketingRouter.get('/:id/sends', async (req: Request, res: Response) => {
  const campaignId = req.params.id as string;
  try {
    const query = CampaignSendsQuerySchema.parse(req.query);

    const sends = await db
      .select()
      .from(campaignSends)
      .where(eq(campaignSends.campaignId, campaignId))
      .orderBy(campaignSends.createdAt)
      .limit(query.limit ?? 50)
      .offset(query.offset ?? 0);

    res.json({
      success: true,
      data: sends,
      meta: { count: sends.length },
    });
  } catch (err) {
    const error = err as unknown;
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }
    logger.error({ err, campaignId: campaignId }, 'marketing_sends_error');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
  }
});
