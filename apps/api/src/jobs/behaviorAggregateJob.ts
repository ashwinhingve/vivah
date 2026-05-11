/**
 * behaviorAggregateJob.ts — Nightly Behavior Summary Rollup
 *
 * Cron: "30 20 * * *" UTC = 02:00 IST.
 * Aggregates the prior calendar day's behavior_events documents from MongoDB
 * into user_behavior_summary Postgres rows (one per user per day).
 *
 * Route-pattern counters:
 *   profile_view_count      ← GET /api/v1/profiles/:id, /api/v1/profiles/matches
 *   browse_query_count      ← GET /api/v1/matchmaking/feed (and search)
 *   message_count           ← POST /api/v1/chat/messages and rooms
 *   photo_expansion_count   ← GET /api/v1/profiles/:id/photos/:photoId
 *   total_request_count     ← any captured event
 *
 * Skipped in mock-mode (shouldUseMockMongo). Reads from BehaviorEvent (Mongo);
 * writes through Drizzle to Postgres with UPSERT semantics (idempotent re-run).
 */

import { Worker, Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import { connection } from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import { userBehaviorSummary } from '@smartshaadi/db';
import { BehaviorEvent } from '../infrastructure/mongo/models/BehaviorEvent.js';
import { shouldUseMockMongo } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const QUEUE_NAME = 'behavior-aggregate-nightly';
const REPEAT_KEY = 'behavior-aggregate-cron';
const CRON_UTC   = '30 20 * * *';

export interface BehaviorAggregateJob {
  scheduledAt: string;
}

export const behaviorAggregateQueue = new Queue<BehaviorAggregateJob>(
  QUEUE_NAME,
  { connection },
);

interface Bucket {
  userId:              string;
  profileViewCount:    number;
  browseQueryCount:    number;
  messageCount:        number;
  photoExpansionCount: number;
  totalRequestCount:   number;
}

function classify(route: string): keyof Omit<Bucket, 'userId' | 'totalRequestCount'> | null {
  if (/\/profiles\/[^/]+\/photos/.test(route))                  return 'photoExpansionCount';
  if (/\/profiles\/(matches|[^/]+)$/.test(route))               return 'profileViewCount';
  if (/\/matchmaking\/(feed|search)/.test(route))               return 'browseQueryCount';
  if (/\/chat\/(messages|rooms)/.test(route))                   return 'messageCount';
  return null;
}

export function registerBehaviorAggregateWorker(): Worker<BehaviorAggregateJob> {
  const worker = new Worker<BehaviorAggregateJob>(
    QUEUE_NAME,
    async (job) => {
      if (shouldUseMockMongo) {
        logger.info('[behaviorAggregate] mock mode — skip');
        return { skipped: true };
      }

      const now    = new Date(job.data.scheduledAt);
      const start  = new Date(now);
      start.setUTCDate(start.getUTCDate() - 1);
      start.setUTCHours(0, 0, 0, 0);
      const end    = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      const day = start.toISOString().slice(0, 10);

      const events = await BehaviorEvent.find({
        ts: { $gte: start, $lt: end },
      })
        .select({ userId: 1, route: 1 })
        .lean<Array<{ userId: string; route: string }>>();

      const byUser = new Map<string, Bucket>();
      for (const ev of events) {
        const bucket = byUser.get(ev.userId) ?? {
          userId:              ev.userId,
          profileViewCount:    0,
          browseQueryCount:    0,
          messageCount:        0,
          photoExpansionCount: 0,
          totalRequestCount:   0,
        };
        bucket.totalRequestCount += 1;
        const slot = classify(ev.route);
        if (slot) bucket[slot] += 1;
        byUser.set(ev.userId, bucket);
      }

      let upserted = 0;
      for (const b of byUser.values()) {
        await db
          .insert(userBehaviorSummary)
          .values({
            userId:              b.userId,
            day,
            profileViewCount:    b.profileViewCount,
            browseQueryCount:    b.browseQueryCount,
            messageCount:        b.messageCount,
            photoExpansionCount: b.photoExpansionCount,
            totalRequestCount:   b.totalRequestCount,
          })
          .onConflictDoUpdate({
            target: [userBehaviorSummary.userId, userBehaviorSummary.day],
            set: {
              profileViewCount:    b.profileViewCount,
              browseQueryCount:    b.browseQueryCount,
              messageCount:        b.messageCount,
              photoExpansionCount: b.photoExpansionCount,
              totalRequestCount:   b.totalRequestCount,
              updatedAt:           sql`now()`,
            },
          });
        upserted += 1;
      }

      logger.info(
        { day, users: upserted, events: events.length },
        '[behaviorAggregate] done',
      );
      return { day, users: upserted, events: events.length };
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[behaviorAggregate] job failed');
  });

  return worker;
}

export async function scheduleBehaviorAggregateJob(): Promise<void> {
  await behaviorAggregateQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat:       { pattern: CRON_UTC },
      attempts:     3,
      backoff:      { type: 'exponential', delay: 60_000 },
      removeOnFail: { count: 50 },
    },
  );
}
