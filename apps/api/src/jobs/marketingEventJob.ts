/**
 * Smart Shaadi — Marketing Event Worker (Unit 6.4, Sprint J)
 *
 * Consumes product-event jobs and dispatches EVENT-triggered campaigns.
 * If a campaign specifies delayMinutes, re-enqueues the job delayed rather
 * than sleeping (non-blocking).
 */

import { Worker } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import {
  connection,
  marketingEventQueue,
  type MarketingEventJob,
} from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { marketingCampaigns } from '@smartshaadi/db';
import { dispatchToUser } from '../marketing/service.js';

const QUEUE_NAME = 'marketing-event';

export function registerMarketingEventWorker(): Worker<MarketingEventJob> {
  const worker = new Worker<MarketingEventJob>(
    QUEUE_NAME,
    async (job) => {
      const { eventType, userId, occurredAt, meta } = job.data;

      // Find ACTIVE campaigns with matching event hook
      const campaigns = await db
        .select()
        .from(marketingCampaigns)
        .where(
          and(
            eq(marketingCampaigns.eventHookKey, eventType),
            eq(marketingCampaigns.status, 'ACTIVE'),
          ),
        );

      let sends = 0;
      for (const campaign of campaigns) {
        const scheduleConfig = campaign.scheduleConfig as Record<string, unknown> | null;
        const delayMinutes = scheduleConfig?.delayMinutes as number | undefined;

        if (delayMinutes && delayMinutes > 0) {
          // Re-enqueue with delay instead of sleeping
          const delayMs = delayMinutes * 60 * 1000;
          const delayedJobId = `${job.id}-delayed`;
          const jobPayload: MarketingEventJob = {
            eventType,
            userId,
            occurredAt,
          };
          if (meta) jobPayload.meta = meta;
          await marketingEventQueue.add(
            eventType,
            jobPayload,
            {
              delay: delayMs,
              jobId: delayedJobId,
              removeOnComplete: true,
              removeOnFail: { count: 5 },
            },
          );
          continue;
        }

        // Dispatch immediately
        const result = await dispatchToUser(campaign, userId);
        if (result.inserted && result.status === 'SENT') sends++;
      }

      logger.info({ eventType, userId, campaignsMatched: campaigns.length, sends }, 'marketing_event_job');
      return { sends };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { err, jobId: job?.id, eventType: job?.data.eventType, userId: job?.data.userId },
      'marketing_event_job_failed',
    );
  });

  return worker;
}
