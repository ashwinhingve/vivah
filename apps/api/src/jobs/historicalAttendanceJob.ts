/**
 * historicalAttendanceJob.ts — Nightly Historical Attendance Rate Updater
 *
 * Cron: "30 20 * * *" UTC = 02:00 IST (after invitation traffic subsides).
 * For each guest with more than one guestCeremonyInvites row, computes:
 *   attended_count = COUNT(rows WHERE rsvpStatus = 'YES')
 *   invited_count  = COUNT(all rows for that guest)
 *   rate           = attended / invited  (clamped to [0.0, 1.0])
 *
 * Updates guests.historical_attendance_rate.
 * Guests with invited_count ≤ 1 are skipped (insufficient signal).
 *
 * Concurrency: 5 (pure SQL, no AI calls).
 */

import { Worker, Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import { connection } from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';

const QUEUE_NAME  = 'historical-attendance-nightly';
const REPEAT_KEY  = 'historical-attendance-cron';
const CRON_UTC    = '30 20 * * *'; // 02:00 IST
const CONCURRENCY = 5;

export interface HistoricalAttendanceJob {
  scheduledAt: string;
}

export const historicalAttendanceQueue = new Queue<HistoricalAttendanceJob>(
  QUEUE_NAME,
  { connection },
);

/**
 * Register the BullMQ worker that computes and persists historical attendance
 * rates for all guests with more than one ceremony invite.
 */
export function registerHistoricalAttendanceWorker(): Worker<HistoricalAttendanceJob> {
  const worker = new Worker<HistoricalAttendanceJob>(
    QUEUE_NAME,
    async (job) => {
      console.info(`[historicalAttendanceJob] starting at ${job.data.scheduledAt}`);
      const startMs = Date.now();

      // Single UPDATE using a CTE:
      //   1. Aggregate guest_ceremony_invites per guest_id with COUNT(*) > 1.
      //   2. Compute rate = attended / invited clamped to [0.0, 1.0].
      //   3. Write back to guests.historical_attendance_rate.
      const result = await db.execute(sql`
        WITH stats AS (
          SELECT
            guest_id,
            COUNT(*)                                        AS invited,
            COUNT(*) FILTER (WHERE rsvp_status = 'YES')    AS attended
          FROM guest_ceremony_invites
          GROUP BY guest_id
          HAVING COUNT(*) > 1
        )
        UPDATE guests
        SET historical_attendance_rate =
          LEAST(1.0, GREATEST(0.0,
            stats.attended::decimal / stats.invited
          ))
        FROM stats
        WHERE guests.id = stats.guest_id
        RETURNING guests.id
      `);

      const updated = (result as unknown as { rowCount?: number }).rowCount
        ?? (result as unknown as unknown[]).length
        ?? 0;

      const durationMs = Date.now() - startMs;
      console.info(
        `[historicalAttendanceJob] done — updated ${updated} guests in ${durationMs}ms`,
      );

      return { updated, durationMs };
    },
    { connection, concurrency: CONCURRENCY },
  );

  worker.on('failed', (job, jobErr) => {
    console.error(`[historicalAttendanceJob] job ${job?.id} failed:`, jobErr);
  });

  return worker;
}

/**
 * Schedules the nightly historical attendance cron job.
 * Idempotent — safe to call on every boot.
 */
export async function scheduleHistoricalAttendanceJob(): Promise<void> {
  await historicalAttendanceQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat:           { pattern: CRON_UTC },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}
