/**
 * Nightly vendor availability + utilization refresh.
 *
 * Cron: "30 21 * * *" UTC = 3am IST. Walks all active vendors, computes
 * utilization stats, and writes them to Redis under
 * `vendor:utilization:{vendorId}` with a 36h TTL. The GET pipeline endpoint
 * reads this cache (falling back to live compute on miss), so the refresh
 * keeps that path warm and cheap during business hours.
 */
import { Worker, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { connection } from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import { vendors } from '@smartshaadi/db';
import {
  computeVendorUtilization,
  writeCachedUtilization,
} from '../services/vendorEngine/availabilityScorer.js';

const QUEUE_NAME = 'vendor-availability-refresh-nightly';
const REPEAT_KEY = 'vendor-availability-refresh-cron';
const CRON_UTC   = '30 21 * * *'; // 3am IST
const CONCURRENCY = 5;

export interface VendorAvailabilityRefreshJob {
  scheduledAt: string;
}

export const vendorAvailabilityRefreshQueue =
  new Queue<VendorAvailabilityRefreshJob>(QUEUE_NAME, { connection });

export function registerVendorAvailabilityRefreshWorker(): Worker<VendorAvailabilityRefreshJob> {
  const worker = new Worker<VendorAvailabilityRefreshJob>(
    QUEUE_NAME,
    async (job) => {
      const startMs = Date.now();
      console.info(`[vendorAvailabilityRefreshJob] starting at ${job.data.scheduledAt}`);

      const rows = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.isActive, true));

      let processed = 0;
      let failed    = 0;

      for (let i = 0; i < rows.length; i += CONCURRENCY) {
        const batch = rows.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          batch.map(async ({ id }) => {
            try {
              const stats = await computeVendorUtilization(id);
              await writeCachedUtilization(id, stats);
              processed++;
            } catch {
              failed++;
            }
          }),
        );
      }

      const durationMs = Date.now() - startMs;
      console.info(
        `[vendorAvailabilityRefreshJob] done — { count: ${rows.length}, processed: ${processed}, failed: ${failed}, durationMs: ${durationMs} }`,
      );
      return { count: rows.length, processed, failed, durationMs };
    },
    { connection, concurrency: 1, lockDuration: 300_000 },
  );

  worker.on('failed', (job, jobErr) => {
    console.error(`[vendorAvailabilityRefreshJob] job ${job?.id} failed:`, jobErr);
  });

  return worker;
}

export async function scheduleVendorAvailabilityRefreshJob(): Promise<void> {
  await vendorAvailabilityRefreshQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat:           { pattern: CRON_UTC },
      attempts:         3,
      backoff:          { type: 'exponential', delay: 60_000 },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}
