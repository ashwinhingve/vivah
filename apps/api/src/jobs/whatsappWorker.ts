/**
 * BullMQ Worker — consumes the `whatsapp-send` queue and calls the WhatsApp
 * provider (mocked until WHATSAPP_LIVE). Started from apps/api/src/index.ts at
 * boot alongside the notifications worker. Mirrors jobs/notificationsWorker.ts.
 */

import { Worker } from 'bullmq';
import { connection, type WhatsAppSendJob } from '../infrastructure/redis/queues.js';
import { processWhatsAppMessage } from '../whatsapp/service.js';

let workerInstance: Worker | null = null;

export interface ClosableWorker { close(): Promise<void> }

export function startWhatsAppWorker(): ClosableWorker {
  if (workerInstance) {
    return { close: () => stopWhatsAppWorker() };
  }

  const w = new Worker<WhatsAppSendJob>(
    'whatsapp-send',
    async (job) => {
      try {
        await processWhatsAppMessage(job.data.messageId);
      } catch (err) {
        console.error('[whatsapp-worker] job failed:', job.id, err);
        throw err;
      }
    },
    {
      connection,
      concurrency: 10,
    },
  );

  w.on('failed', (job, err) => {
    console.error(`[whatsapp-worker] job ${job?.id} failed:`, err.message);
  });

  workerInstance = w;
  console.log('[whatsapp-worker] started');
  return { close: () => stopWhatsAppWorker() };
}

export async function stopWhatsAppWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
