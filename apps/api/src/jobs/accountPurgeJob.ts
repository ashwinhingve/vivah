/**
 * Smart Shaadi — Account purge job
 * apps/api/src/jobs/accountPurgeJob.ts
 *
 * Hard-deletes users whose deletionRequestedAt is older than 30 days.
 * Runs hourly via a BullMQ repeatable job — under multi-instance Railway
 * deploys this dedups across pods (one purge per hour, not N per pod).
 *
 * Cascade delete is handled by FK constraints on session, account, two_factor,
 * auth_events, profiles (et al) — all reference user.id with ON DELETE CASCADE
 * or are joined to profile.userId which itself cascades.
 */

import { lt, and, isNotNull } from 'drizzle-orm';
import { Worker, Queue } from 'bullmq';
import { user } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { connection } from '../infrastructure/redis/queues.js';

const QUEUE_NAME = 'account-purge';
const REPEAT_KEY = 'account-purge-hourly';
const REPEAT_EVERY_MS = 60 * 60 * 1000;
const GRACE_DAYS = 30;

interface AccountPurgeJob { scheduledAt: string }

export async function purgeExpiredDeletions(): Promise<number> {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db.delete(user)
    .where(and(isNotNull(user.deletionRequestedAt), lt(user.deletionRequestedAt, cutoff)))
    .returning({ id: user.id });
  if (deleted.length > 0) {
    console.info(`[account-purge] purged ${deleted.length} accounts past 30-day grace`);
  }
  return deleted.length;
}

let worker: Worker<AccountPurgeJob> | null = null;
let queue: Queue<AccountPurgeJob> | null = null;

export function startAccountPurgeWorker(): { close(): Promise<void> } {
  if (worker) return { close: () => stopAccountPurgeWorker() };
  queue = new Queue<AccountPurgeJob>(QUEUE_NAME, { connection });
  worker = new Worker<AccountPurgeJob>(
    QUEUE_NAME,
    async () => {
      const purged = await purgeExpiredDeletions();
      return { purged };
    },
    { connection },
  );
  worker.on('failed', (job, err) => {
    console.warn(`[account-purge] job ${job?.id} failed:`, err);
  });
  // Idempotent — BullMQ keys repeats by jobId so multiple boots don't fan out.
  void queue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    { repeat: { every: REPEAT_EVERY_MS }, removeOnComplete: { count: 50 }, removeOnFail: { count: 50 } },
  );
  return { close: () => stopAccountPurgeWorker() };
}

export async function stopAccountPurgeWorker(): Promise<void> {
  try {
    if (worker) await worker.close();
    if (queue)  await queue.close();
  } finally {
    worker = null;
    queue = null;
  }
}
