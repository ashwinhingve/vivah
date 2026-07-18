/**
 * Smart Shaadi — Marketing Content Generation Worker (Unit 6.4)
 *
 * BullMQ worker that processes marketingContentGenerateQueue jobs.
 * Generates en+hi DRAFT content via LLM or falls back to templates.
 *
 * Job payload: { campaignId, brief? }
 * Result: { enId, hiId, source: 'llm' | 'fallback' }
 */

import { Worker } from 'bullmq';
import { connection, type MarketingContentGenerateJob } from '../infrastructure/redis/queues.js';
import { logger } from '../lib/logger.js';
import { workerGenerateContent } from '../marketing/content.js';

export function registerMarketingContentGenerateWorker(): Worker<MarketingContentGenerateJob> {
  const worker = new Worker<MarketingContentGenerateJob>(
    'marketing-content-generate',
    async (job) => {
      const { campaignId, brief } = job.data;

      logger.info(
        { campaignId, brief, jobId: job.id },
        'marketing_content_generation_job_start',
      );

      try {
        const result = await workerGenerateContent(campaignId, brief);

        logger.info(
          {
            campaignId,
            jobId: job.id,
            enId: result.enId,
            hiId: result.hiId,
            source: result.source,
          },
          'marketing_content_generation_complete',
        );

        return result;
      } catch (err) {
        logger.error(
          { campaignId, jobId: job.id, error: String(err) },
          'marketing_content_generation_failed',
        );

        throw err;
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, campaignId: job?.data?.campaignId, error: String(err) },
      'marketing_content_generation_job_failed',
    );
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, campaignId: job.data.campaignId }, 'marketing_content_generation_job_succeeded');
  });

  return worker;
}
