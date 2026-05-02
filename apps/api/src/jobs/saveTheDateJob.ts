/**
 * Smart Shaadi — Save-the-Date Worker
 *
 * Fires save-the-date invitation through the unified channel sender.
 * Mock-safe.
 */

import { Worker } from 'bullmq';
import {
  connection,
  type SaveTheDateJob,
} from '../infrastructure/redis/queues.js';
import { sendInvitations } from '../guests/invitation.js';
import { env } from '../lib/env.js';

const QUEUE_NAME = 'save-the-date';

export function registerSaveTheDateWorker(): Worker<SaveTheDateJob> {
  const worker = new Worker<SaveTheDateJob>(
    QUEUE_NAME,
    async (job) => {
      const { weddingId, guestId, channel } = job.data;

      if (env.USE_MOCK_SERVICES) {
        console.info(`[saveTheDate] MOCK ${channel} STD for guest ${guestId} (wedding ${weddingId})`);
        return { sent: 1, mocked: true };
      }

      const result = await sendInvitations(weddingId, {
        guestIds: [guestId],
        channel:  channel as 'EMAIL' | 'SMS' | 'WHATSAPP',
        type:     'SAVE_THE_DATE',
      });
      return result;
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[saveTheDate] job ${job?.id} failed:`, err);
  });

  return worker;
}
