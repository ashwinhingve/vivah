/**
 * BullMQ Worker — consumes `notifications` queue and fans out via channels.
 * Started from apps/api/src/index.ts at boot.
 */

import { Worker } from 'bullmq';
import { connection } from '../infrastructure/redis/queues.js';
import { deliverNotification, type NotificationDeliveryJob } from '../notifications/service.js';

let workerInstance: Worker | null = null;

export interface ClosableWorker { close(): Promise<void> }

export function startNotificationsWorker(): ClosableWorker {
  if (workerInstance) {
    return { close: () => stopNotificationsWorker() };
  }

  const w = new Worker<NotificationDeliveryJob>(
    'notifications',
    async (job) => {
      try {
        const result = await deliverNotification(job.data);
        return result;
      } catch (err) {
        console.error('[notifications-worker] job failed:', job.id, err);
        throw err;
      }
    },
    {
      connection,
      concurrency: 10,
    },
  );

  w.on('failed', (job, err) => {
    console.error(`[notifications-worker] job ${job?.id} failed:`, err.message);
  });

  workerInstance = w;
  console.log('[notifications-worker] started');
  return { close: () => stopNotificationsWorker() };
}

export async function stopNotificationsWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
