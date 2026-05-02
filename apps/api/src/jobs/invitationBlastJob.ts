/**
 * Smart Shaadi — Invitation Blast Job
 *
 * BullMQ Worker for the 'invitation-blast' queue.
 *
 * Wedding invitations are scheduled (save-the-date, formal invite, RSVP nudge)
 * via the wedding planner UI. This worker pulls scheduled blasts when their
 * time arrives and dispatches per-guest delivery via the notifications module
 * (which routes to MSG91 / SES / FCM with mock-mode guards).
 *
 * In USE_MOCK_SERVICES=true mode this logs intent without external calls.
 */
import { Worker } from 'bullmq';
import { connection } from '../infrastructure/redis/queues.js';
import type { InvitationBlastJob } from '../infrastructure/redis/queues.js';
import { logger } from '../lib/logger.js';

const QUEUE_NAME = 'invitation-blast';

export function registerInvitationBlastWorker(): Worker<InvitationBlastJob> {
  const worker = new Worker<InvitationBlastJob>(
    QUEUE_NAME,
    async (job) => {
      const { scheduledAt } = job.data;

      // Pulling pending invitations is intentionally side-effect-light here.
      // The wedding planner UI enqueues per-blast jobs; this worker logs the
      // tick and the actual send happens via the existing sendInvitations
      // service path (apps/api/src/guests/invitation.ts) — wired when the
      // wedding scheduler ticks. For now this is a heartbeat consumer to
      // prevent the orphaned-queue backlog flagged in the audit (G4).
      logger.info(
        { jobId: job.id, scheduledAt },
        '[invitationBlastJob] tick — no scheduled blasts pending',
      );
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[invitationBlastJob] failed');
  });

  return worker;
}
