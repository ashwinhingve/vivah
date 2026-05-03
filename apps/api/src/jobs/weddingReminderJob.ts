/**
 * Smart Shaadi — Wedding Reminder Dispatcher
 *
 * Periodic sweeper that picks unsent wedding_reminders rows whose
 * scheduledAt is in the past, fans them out to the notifications queue,
 * and marks them sent. Idempotent — won't re-send.
 */
import { Worker } from 'bullmq';
import {
  connection,
  weddingReminderQueue,
  queueNotification,
  type WeddingReminderJob,
} from '../infrastructure/redis/queues.js';
import {
  fetchDueReminders,
  markReminderSent,
  markReminderFailed,
} from '../weddings/reminders.service.js';
import { db } from '../lib/db.js';
import { weddings, profiles } from '@smartshaadi/db';
import { eq } from 'drizzle-orm';

const QUEUE_NAME = 'wedding-reminder';
const REPEAT_KEY = 'wedding-reminder-sweep';
const REPEAT_EVERY_MS = 5 * 60 * 1000;  // every 5 minutes

export function registerWeddingReminderWorker(): Worker<WeddingReminderJob> {
  const worker = new Worker<WeddingReminderJob>(
    QUEUE_NAME,
    async () => {
      const due = await fetchDueReminders(100);
      let dispatched = 0;
      let failed     = 0;

      for (const r of due) {
        try {
          // Resolve wedding → profile → Better Auth userId. Notifications
          // route by userId; passing profileId or weddingId silently drops
          // the message because the downstream dispatcher finds no recipient.
          const [w] = await db
            .select({ userId: profiles.userId })
            .from(weddings)
            .innerJoin(profiles, eq(profiles.id, weddings.profileId))
            .where(eq(weddings.id, r.weddingId))
            .limit(1);

          if (!w?.userId) {
            await markReminderFailed(r.id);
            failed++;
            console.warn(`[weddingReminder] no userId for wedding=${r.weddingId}, skipping reminder=${r.id}`);
            continue;
          }

          await queueNotification({
            userId:  w.userId,
            type:    r.type,
            payload: { weddingId: r.weddingId, ceremonyId: r.ceremonyId, channel: r.channel },
          });
          await markReminderSent(r.id);
          dispatched++;
        } catch (e) {
          await markReminderFailed(r.id);
          failed++;
          console.warn(`[weddingReminder] failed reminder=${r.id}:`, (e as Error).message);
        }
      }

      console.info(`[weddingReminder] dispatched=${dispatched} failed=${failed} swept=${due.length}`);
      return { dispatched, failed, swept: due.length };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[weddingReminder] worker job ${job?.id} failed:`, err);
  });

  return worker;
}

export async function scheduleWeddingReminderJob(): Promise<void> {
  await weddingReminderQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { every: REPEAT_EVERY_MS },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}
