/**
 * Smart Shaadi — Marketing Content Management (Unit 6.4)
 *
 * Service functions for campaign content:
 * - Generate content via LLM (enqueue job)
 * - Approve content (atomic DRAFT → APPROVED)
 * - Upsert manual content (override copy)
 * - List content per campaign
 */

import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { campaignContent, marketingCampaigns } from '@smartshaadi/db';
import type {
  CampaignContent,
  GeneratedCampaignContent,
  MarketingLanguage,
} from '@smartshaadi/types';
import { marketingContentGenerateQueue, type MarketingContentGenerateJob } from '../infrastructure/redis/queues.js';
import { callAiService } from '../lib/ai.js';
import { logger } from '../lib/logger.js';
import { FALLBACK_TEMPLATES } from './templates.js';

/**
 * Request generation of LLM-powered content for a campaign.
 *
 * Validates campaign exists, then enqueues a job to generate en+hi copy.
 * Returns a queued marker (no polling needed — worker persists results to DB).
 *
 * Throws: 404 if campaign not found, 400 if campaign has no template.
 */
export async function requestGeneration(
  campaignId: string,
  brief?: string,
): Promise<{ queued: boolean; jobId: string }> {
  // Validate campaign exists
  const [campaign] = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  if (!campaign.templateKey) {
    throw new Error(`Campaign ${campaignId} has no template key`);
  }

  // Enqueue generation job
  const jobId = `mkt-content-${campaignId}`;
  const jobData: MarketingContentGenerateJob = { campaignId };
  if (brief) jobData.brief = brief;

  await marketingContentGenerateQueue.add(
    jobId,
    jobData,
    {
      jobId, // idempotent by campaign
      attempts: 5,
      backoff: { type: 'exponential' as const, delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 100 },
    },
  );

  logger.info({ campaignId, jobId, brief }, 'marketing_content_generation_enqueued');

  return { queued: true, jobId };
}

/**
 * Approve a single content row atomically (DRAFT → APPROVED).
 *
 * Throws: 409 if content is not in DRAFT status, 404 if content not found.
 */
export async function approveContent(
  contentId: string,
  adminUserId: string,
): Promise<CampaignContent> {
  // Atomic conditional update
  const updated = await db
    .update(campaignContent)
    .set({
      status: 'APPROVED' as const,
      approvedByUserId: adminUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(campaignContent.id, contentId),
        eq(campaignContent.status, 'DRAFT' as const),
      ),
    )
    .returning();

  if (updated.length === 0) {
    // Try to find why: content exists but not DRAFT, or doesn't exist at all
    const [existing] = await db
      .select()
      .from(campaignContent)
      .where(eq(campaignContent.id, contentId))
      .limit(1);

    if (!existing) {
      throw new Error(`Content ${contentId} not found`);
    }

    throw new Error(`Content ${contentId} is not in DRAFT status (current: ${existing.status})`);
  }

  logger.info({ contentId, adminUserId }, 'marketing_content_approved');

  return updated[0]! as unknown as CampaignContent;
}

/**
 * Upsert manual content for a campaign+language (lands as DRAFT).
 *
 * If a live row exists for this campaign+language, update it; otherwise insert.
 * Respects the partial-unique constraint (campaignId, language) WHERE status IN ('DRAFT', 'APPROVED').
 *
 * Always creates DRAFT rows (manual, not LLM-generated).
 */
export async function upsertManualContent(
  campaignId: string,
  language: MarketingLanguage,
  input: {
    subjectLine?: string | null;
    bodyShort: string;
    bodyLong?: string | null;
    ctaText?: string | null;
    ctaUrl?: string | null;
  },
): Promise<CampaignContent> {
  const [campaign] = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const now = new Date();

  // Find existing live row (DRAFT or APPROVED)
  const [existing] = await db
    .select()
    .from(campaignContent)
    .where(
      and(
        eq(campaignContent.campaignId, campaignId),
        eq(campaignContent.language, language),
        inArray(campaignContent.status, ['DRAFT', 'APPROVED'] as const),
      ),
    )
    .limit(1);

  if (existing) {
    // Update existing
    const updated = await db
      .update(campaignContent)
      .set({
        subjectLine: input.subjectLine ?? null,
        bodyShort: input.bodyShort,
        bodyLong: input.bodyLong ?? null,
        ctaText: input.ctaText ?? null,
        ctaUrl: input.ctaUrl ?? null,
        generatedByLlm: false,
        modelVersion: null,
        updatedAt: now,
      })
      .where(eq(campaignContent.id, existing.id))
      .returning();

    logger.info(
      { campaignId, language, contentId: existing.id, action: 'update' },
      'manual_content_upserted',
    );

    return updated[0]! as unknown as CampaignContent;
  }

  // Insert new DRAFT row
  const newContent = await db
    .insert(campaignContent)
    .values({
      campaignId,
      templateKey: campaign.templateKey,
      language,
      status: 'DRAFT' as const,
      subjectLine: input.subjectLine ?? null,
      bodyShort: input.bodyShort,
      bodyLong: input.bodyLong ?? null,
      ctaText: input.ctaText ?? null,
      ctaUrl: input.ctaUrl ?? null,
      generatedByLlm: false,
      modelVersion: null,
      approvedByUserId: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info(
    { campaignId, language, contentId: newContent[0]?.id, action: 'insert' },
    'manual_content_upserted',
  );

  return newContent[0]! as unknown as CampaignContent;
}

/**
 * List all content rows for a campaign (all statuses).
 */
export async function listContent(campaignId: string): Promise<CampaignContent[]> {
  const rows = await db
    .select()
    .from(campaignContent)
    .where(eq(campaignContent.campaignId, campaignId))
    .orderBy(campaignContent.createdAt);

  return rows as unknown as CampaignContent[];
}

/**
 * Worker: Generate content via LLM and persist en+hi DRAFT rows.
 *
 * Flow:
 * 1. Load campaign (must exist; must have templateKey).
 * 2. Call ai-service POST /marketing/generate.
 * 3. On success: upsert en+hi rows as DRAFT with generatedByLlm=true.
 * 4. On AI failure: fall back to FALLBACK_TEMPLATES (generatedByLlm=false).
 * 5. Pipeline never dead-ends; both paths create usable content.
 *
 * Idempotent per campaign (existing rows are updated if same language).
 */
export async function workerGenerateContent(
  campaignId: string,
  brief?: string,
): Promise<{ enId: string; hiId: string; source: 'llm' | 'fallback' }> {
  // Load campaign
  const [campaign] = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found (worker)`);
  }

  const now = new Date();
  let source: 'llm' | 'fallback' = 'fallback';
  let generated: GeneratedCampaignContent | null = null;

  // Try LLM
  try {
    generated = await callAiService<GeneratedCampaignContent>('/marketing/generate', {
      campaign_name: campaign.name,
      description: campaign.description,
      segment_key: campaign.segmentKey,
      template_key: campaign.templateKey,
      conversion_goal: campaign.conversionGoal,
      brief,
    });

    source = 'llm';
    logger.info({ campaignId, source }, 'marketing_content_generated_from_llm');
  } catch (err) {
    logger.warn(
      { campaignId, error: String(err) },
      'marketing_llm_generation_failed_falling_back_to_templates',
    );

    // Fall back to templates
    const template = FALLBACK_TEMPLATES[campaign.templateKey] ?? FALLBACK_TEMPLATES['fallback'];
    if (!template) {
      throw new Error(`No template found for ${campaign.templateKey}`);
    }
    generated = {
      en: template.en,
      hi: template.hi,
      modelVersion: 'fallback-v1',
    };
    source = 'fallback';
  }

  // Upsert en+hi rows as DRAFT
  const enContent = await upsertManualContent(campaignId, 'en', {
    subjectLine: generated.en.subjectLine,
    bodyShort: generated.en.bodyShort,
    bodyLong: generated.en.bodyLong,
    ctaText: generated.en.ctaText,
  });

  // Manually set LLM metadata for English
  await db
    .update(campaignContent)
    .set({
      generatedByLlm: source === 'llm',
      generatedAt: source === 'llm' ? now : null,
      modelVersion: generated.modelVersion,
    })
    .where(eq(campaignContent.id, enContent.id));

  const hiContent = await upsertManualContent(campaignId, 'hi', {
    subjectLine: generated.hi.subjectLine,
    bodyShort: generated.hi.bodyShort,
    bodyLong: generated.hi.bodyLong,
    ctaText: generated.hi.ctaText,
  });

  // Manually set LLM metadata for Hindi
  await db
    .update(campaignContent)
    .set({
      generatedByLlm: source === 'llm',
      generatedAt: source === 'llm' ? now : null,
      modelVersion: generated.modelVersion,
    })
    .where(eq(campaignContent.id, hiContent.id));

  logger.info(
    { campaignId, source, enId: enContent.id, hiId: hiContent.id },
    'marketing_content_workflow_complete',
  );

  return { enId: enContent.id, hiId: hiContent.id, source };
}
