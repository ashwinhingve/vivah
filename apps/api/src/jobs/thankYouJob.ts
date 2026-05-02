/**
 * Smart Shaadi — Thank-You Worker
 *
 * Fires 24h after RSVP YES. Re-checks current rsvpStatus before sending —
 * skip if guest changed mind to NO/MAYBE before the delay elapsed.
 * Mock-safe.
 */

import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import {
  connection,
  type ThankYouJob,
} from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import { guests } from '@smartshaadi/db';
import { sendInvitations } from '../guests/invitation.js';
import { env } from '../lib/env.js';

const QUEUE_NAME = 'thank-you';

export function registerThankYouWorker(): Worker<ThankYouJob> {
  const worker = new Worker<ThankYouJob>(
    QUEUE_NAME,
    async (job) => {
      const { weddingId, guestId } = job.data;

      // Confirm guest still YES before sending thanks
      const [g] = await db.select({ rsvpStatus: guests.rsvpStatus }).from(guests)
        .where(eq(guests.id, guestId)).limit(1);
      if (!g || g.rsvpStatus !== 'YES') {
        return { sent: 0, skipped: true, reason: 'rsvp_not_yes' };
      }

      if (env.USE_MOCK_SERVICES) {
        console.info(`[thankYou] MOCK thank-you for guest ${guestId} (wedding ${weddingId})`);
        return { sent: 1, mocked: true };
      }

      const result = await sendInvitations(weddingId, {
        guestIds: [guestId],
        channel:  'EMAIL',
        type:     'THANK_YOU',
      });
      return result;
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[thankYou] job ${job?.id} failed:`, err);
  });

  return worker;
}
