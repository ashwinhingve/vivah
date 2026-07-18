/**
 * Smart Shaadi — Marketing Content API Router (Unit 6.4)
 *
 * Endpoints:
 * - POST /:campaignId/generate — Request LLM generation (enqueue job)
 * - GET /:campaignId — List all content rows for a campaign
 * - POST /approve — Approve a single content row (DRAFT → APPROVED)
 * - PUT /:campaignId — Upsert manual content for a language
 *
 * All endpoints require ADMIN role.
 */

import { Router, type Request, type Response } from 'express';
import { ApproveContentSchema, GenerateContentSchema, UpsertContentSchema } from '@smartshaadi/schemas';
import { authenticate, authorize } from '../auth/middleware.js';
import {
  requestGeneration,
  approveContent,
  upsertManualContent,
  listContent,
} from './content.js';
import { ok, err } from '../lib/response.js';
import { logger } from '../lib/logger.js';

export const marketingContentRouter = Router();

/**
 * POST /:campaignId/generate
 *
 * Request LLM generation of en+hi DRAFT content for a campaign.
 * Enqueues a job; returns immediately with queued marker.
 */
marketingContentRouter.post(
  '/:campaignId/generate',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const campaignId = req.params['campaignId'] ?? '';
    const parsed = GenerateContentSchema.safeParse(req.body);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    const { brief } = parsed.data;

    try {
      const result = await requestGeneration(campaignId, brief);
      ok(res, result);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('not found')) { err(res, 'NOT_FOUND', msg, 404); return; }
      err(res, 'BAD_REQUEST', msg, 400);
    }
  },
);

/**
 * GET /:campaignId
 *
 * List all content rows for a campaign (all statuses).
 */
marketingContentRouter.get(
  '/:campaignId',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const campaignId = req.params['campaignId'] ?? '';

    try {
      const rows = await listContent(campaignId);
      ok(res, rows);
    } catch (e) {
      logger.warn({ error: String(e) }, 'marketing_content_list_error');
      err(res, 'BAD_REQUEST', String(e), 400);
    }
  },
);

/**
 * POST /approve
 *
 * Approve a single content row (DRAFT → APPROVED).
 * Atomic conditional update; conflicts on non-DRAFT status.
 */
marketingContentRouter.post(
  '/approve',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ApproveContentSchema.safeParse(req.body);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    const { contentId } = parsed.data;
    const userId = req.user?.id ?? '';

    try {
      const updated = await approveContent(contentId, userId);
      ok(res, updated);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('not found')) { err(res, 'NOT_FOUND', msg, 404); return; }
      if (msg.includes('not in DRAFT')) { err(res, 'CONFLICT', msg, 409); return; }
      err(res, 'BAD_REQUEST', msg, 400);
    }
  },
);

/**
 * PUT /:campaignId
 *
 * Upsert manual content for a campaign+language (lands as DRAFT).
 */
marketingContentRouter.put(
  '/:campaignId',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const campaignId = req.params['campaignId'] ?? '';
    const parsed = UpsertContentSchema.safeParse(req.body);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    const { language, subjectLine, bodyShort, bodyLong, ctaText, ctaUrl } = parsed.data;

    try {
      const content = await upsertManualContent(campaignId, language, {
        subjectLine: subjectLine ?? null,
        bodyShort,
        bodyLong: bodyLong ?? null,
        ctaText: ctaText ?? null,
        ctaUrl: ctaUrl ?? null,
      });
      ok(res, content);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('not found')) { err(res, 'NOT_FOUND', msg, 404); return; }
      err(res, 'BAD_REQUEST', msg, 400);
    }
  },
);
