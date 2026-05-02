/**
 * Smart Shaadi — Match Request Expiry Sweeper
 *
 * Periodic worker that flips PENDING match_requests with expiresAt < now to
 * EXPIRED and notifies the sender. Schedule on app boot — once daily is enough
 * given a 14-day TTL; no per-request delayed jobs needed.
 */
import { Worker } from 'bullmq';
import {
  connection,
  matchRequestExpiryQueue,
  type MatchRequestExpiryJob,
} from '../infrastructure/redis/queues.js';
import { expireOldRequests } from '../matchmaking/requests/service.js';

const QUEUE_NAME = 'match-request-expiry';
const REPEAT_KEY = 'match-request-expiry-daily';
const REPEAT_EVERY_MS = 24 * 60 * 60 * 1000;

export function registerMatchRequestExpiryWorker(): Worker<MatchRequestExpiryJob> {
  const worker = new Worker<MatchRequestExpiryJob>(
    QUEUE_NAME,
    async (job) => {
      const result = await expireOldRequests();
      console.info(
        `[matchRequestExpiryJob] swept ${result.expired} expired requests at ${job.data.scheduledAt}`,
      );
      return result;
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[matchRequestExpiryJob] job ${job?.id} failed:`, err);
  });

  return worker;
}

/**
 * Schedules the daily repeat job. Idempotent — BullMQ uses jobId-by-key under
 * the hood, so calling on every boot is safe.
 */
export async function scheduleMatchRequestExpiryJob(): Promise<void> {
  await matchRequestExpiryQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { every: REPEAT_EVERY_MS },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}
