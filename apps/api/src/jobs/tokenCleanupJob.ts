/**
 * Smart Shaadi — RSVP Token Cleanup Worker
 *
 * Daily cron at 02:00. Deletes rsvp_tokens with expiresAt < now() to keep
 * the table compact. Idempotent — safe to run repeatedly.
 */

import { Worker } from 'bullmq';
import { lt } from 'drizzle-orm';
import {
  connection,
  tokenCleanupQueue,
  type TokenCleanupJob,
} from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import { rsvpTokens } from '@smartshaadi/db';

const QUEUE_NAME = 'token-cleanup';
const REPEAT_KEY = 'token-cleanup-daily';
const REPEAT_EVERY_MS = 24 * 60 * 60 * 1000;

export function registerTokenCleanupWorker(): Worker<TokenCleanupJob> {
  const worker = new Worker<TokenCleanupJob>(
    QUEUE_NAME,
    async (job) => {
      const now = new Date();
      const removed = await db.delete(rsvpTokens)
        .where(lt(rsvpTokens.expiresAt, now))
        .returning({ id: rsvpTokens.id });
      console.info(`[tokenCleanup] removed ${removed.length} expired token(s) at ${job.data.scheduledAt}`);
      return { removed: removed.length };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[tokenCleanup] job ${job?.id} failed:`, err);
  });

  return worker;
}

export async function scheduleTokenCleanupJob(): Promise<void> {
  await tokenCleanupQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { every: REPEAT_EVERY_MS },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}
