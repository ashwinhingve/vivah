/**
 * Smart Shaadi — Virtual Date Lifecycle Sweep (Phase 7 Sprint F hardening)
 *
 * Hourly worker that advances stalled durable `virtual_dates` rows to their
 * terminal states so a date always leaves a truthful trace:
 *   1. PROPOSED past its start with no response  → CANCELLED (expired)
 *   2. CONFIRMED that ended with zero feedback    → NO_SHOW
 *
 * This is the ONLY writer of the NO_SHOW status. Pure status transitions on
 * already-past rows — no user is messaged — so it is safe to run pre-launch
 * (same posture as the token-cleanup sweep). Schedule on app boot.
 */
import { Worker } from 'bullmq';
import {
  connection,
  virtualDateLifecycleQueue,
  type VirtualDateLifecycleJob,
} from '../infrastructure/redis/queues.js';
import { logger } from '../lib/logger.js';
import { sweepVirtualDateLifecycle } from '../video/service.js';

const QUEUE_NAME = 'virtual-date-lifecycle';
const REPEAT_KEY = 'virtual-date-lifecycle-hourly';
const REPEAT_EVERY_MS = 60 * 60 * 1000; // hourly

export function registerVirtualDateLifecycleWorker(): Worker<VirtualDateLifecycleJob> {
  const worker = new Worker<VirtualDateLifecycleJob>(
    QUEUE_NAME,
    async (job) => {
      const result = await sweepVirtualDateLifecycle();
      logger.info({ ...result, scheduledAt: job.data.scheduledAt }, 'virtual_date_lifecycle_sweep');
      return result;
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'virtual_date_lifecycle_sweep_failed');
  });

  return worker;
}

/** Schedule the hourly repeat job. Idempotent (BullMQ jobId-by-key). */
export async function scheduleVirtualDateLifecycleJob(): Promise<void> {
  await virtualDateLifecycleQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { every: REPEAT_EVERY_MS },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}
