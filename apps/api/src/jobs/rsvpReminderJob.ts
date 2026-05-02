/**
 * Smart Shaadi — RSVP Reminder Worker
 *
 * Triggered N days before RSVP deadline. Looks up PENDING guests for the
 * wedding and dispatches a reminder via existing invitation channels.
 * Mock-safe: no real send when USE_MOCK_SERVICES=true.
 */

import { Worker } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import {
  connection,
  type RsvpReminderJob,
} from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import { guests, guestLists } from '@smartshaadi/db';
import { sendInvitations } from '../guests/invitation.js';
import { env } from '../lib/env.js';

const QUEUE_NAME = 'rsvp-reminder';

export function registerRsvpReminderWorker(): Worker<RsvpReminderJob> {
  const worker = new Worker<RsvpReminderJob>(
    QUEUE_NAME,
    async (job) => {
      const { weddingId, daysBefore } = job.data;

      const [gl] = await db.select({ id: guestLists.id }).from(guestLists)
        .where(eq(guestLists.weddingId, weddingId)).limit(1);
      if (!gl) return { sent: 0, skipped: true };

      const pending = await db.select({ id: guests.id }).from(guests)
        .where(and(eq(guests.guestListId, gl.id), eq(guests.rsvpStatus, 'PENDING')));

      if (pending.length === 0) return { sent: 0, daysBefore };

      if (env.USE_MOCK_SERVICES) {
        console.info(`[rsvpReminder] MOCK ${pending.length} reminder(s) for wedding ${weddingId} (T-${daysBefore}d)`);
        return { sent: pending.length, mocked: true, daysBefore };
      }

      // Real path uses sendInvitations with type=RSVP_REMINDER
      const result = await sendInvitations(weddingId, {
        guestIds: pending.map(g => g.id),
        channel:  'EMAIL',
        type:     'RSVP_REMINDER',
      });
      return { sent: result.sent, failed: result.failed, daysBefore };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[rsvpReminder] job ${job?.id} failed:`, err);
  });

  return worker;
}
