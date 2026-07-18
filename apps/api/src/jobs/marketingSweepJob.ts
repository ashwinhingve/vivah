/**
 * Smart Shaadi — Marketing Sweep Worker (Unit 6.4, Sprint J)
 *
 * Daily repeatable job that runs due SEGMENT_SWEEP and SCHEDULED campaigns,
 * then the conversion-attribution pass. Pattern mirrors churnRecoverySweepJob.
 */

import { Worker } from 'bullmq';
import {
  connection,
  marketingSweepQueue,
  type MarketingSweepJob,
} from '../infrastructure/redis/queues.js';
import { logger } from '../lib/logger.js';
import { runDueCampaigns } from '../marketing/service.js';

const QUEUE_NAME = 'marketing-sweep';
const REPEAT_KEY = 'marketing-daily-sweep';
const REPEAT_EVERY_MS = 24 * 60 * 60 * 1000;

export interface SweepJobResult {
  campaignsRun: number;
  sends: number;
  conversions: number;
}

/**
 * The sweep body — exported for unit testing without the BullMQ wrapper.
 */
export async function runMarketingSweep(): Promise<SweepJobResult> {
  const result = await runDueCampaigns();
  logger.info(result, 'marketing_sweep_complete');
  return result;
}

export function registerMarketingSweepWorker(): Worker<MarketingSweepJob> {
  const worker = new Worker<MarketingSweepJob>(
    QUEUE_NAME,
    async (job) => {
      const result = await runMarketingSweep();
      logger.info({ ...result, scheduledAt: job.data.scheduledAt }, 'marketing_sweep_job');
      return result;
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'marketing_sweep_failed');
  });

  return worker;
}

/**
 * Schedule the daily repeat job. Idempotent (BullMQ jobId-by-key).
 */
export async function scheduleMarketingSweepJob(): Promise<void> {
  await marketingSweepQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { every: REPEAT_EVERY_MS },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    },
  );
}
