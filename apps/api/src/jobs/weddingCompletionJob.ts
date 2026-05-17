/**
 * Smart Shaadi — Wedding Completion Job
 *
 * Delayed BullMQ job on the 'wedding-completion' queue. Scheduled when a
 * wedding is created (or its date changes) for `weddingDate + 1 day`. On fire
 * it flips an active wedding (PLANNING | CONFIRMED) to COMPLETED.
 *
 * Invariants:
 *  - Deterministic jobId `wedding-complete-${weddingId}` — re-scheduling on a
 *    date change replaces the pending job rather than stacking duplicates.
 *  - Idempotent: only PLANNING/CONFIRMED weddings transition. CANCELLED,
 *    already-COMPLETED, or soft-deleted weddings are left untouched.
 */
import { Worker } from 'bullmq';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { weddings } from '@smartshaadi/db';
import {
  connection,
  weddingCompletionQueue,
  DEFAULT_JOB_OPTS,
  type WeddingCompletionJob,
} from '../infrastructure/redis/queues.js';

const QUEUE_NAME = 'wedding-completion';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function jobIdFor(weddingId: string): string {
  return `wedding-complete-${weddingId}`;
}

/**
 * Schedule (or re-schedule) the completion job for a wedding. Safe to call on
 * every create/update — the deterministic jobId means the pending job is
 * replaced, not duplicated. The fire time is the day *after* the wedding date.
 */
export async function scheduleWeddingCompletion(
  weddingId: string,
  weddingDate: string,
): Promise<void> {
  const fireAt = new Date(`${weddingDate}T00:00:00`).getTime() + ONE_DAY_MS;
  const delay = Math.max(0, fireAt - Date.now());

  // Remove any previously scheduled job (date may have moved). remove() is a
  // no-op when the job does not exist.
  try {
    await weddingCompletionQueue.remove(jobIdFor(weddingId));
  } catch {
    // ignore — job absent or already processed
  }

  await weddingCompletionQueue.add(
    'complete-wedding',
    { weddingId, weddingDate },
    {
      delay,
      jobId: jobIdFor(weddingId),
      ...DEFAULT_JOB_OPTS,
    },
  );
}

/** Cancel a pending completion job (e.g. when a wedding is cancelled/deleted). */
export async function cancelWeddingCompletion(weddingId: string): Promise<void> {
  try {
    await weddingCompletionQueue.remove(jobIdFor(weddingId));
  } catch {
    // ignore — nothing scheduled
  }
}

export function registerWeddingCompletionWorker(): Worker<WeddingCompletionJob> {
  const worker = new Worker<WeddingCompletionJob>(
    QUEUE_NAME,
    async (job) => {
      const { weddingId } = job.data;

      const updated = await db
        .update(weddings)
        .set({ status: 'COMPLETED', updatedAt: new Date() })
        .where(
          and(
            eq(weddings.id, weddingId),
            isNull(weddings.deletedAt),
            inArray(weddings.status, ['PLANNING', 'CONFIRMED']),
          ),
        )
        .returning({ id: weddings.id });

      if (updated.length === 0) {
        console.info(
          `[weddingCompletion] wedding ${weddingId} not eligible (cancelled, deleted, or already completed) — skipping`,
        );
        return;
      }

      console.info(`[weddingCompletion] wedding ${weddingId} marked COMPLETED`);
    },
    { connection },
  );

  worker.on('failed', (j, err) => {
    console.error(`[weddingCompletion] job ${j?.id} failed:`, err);
  });

  return worker;
}
