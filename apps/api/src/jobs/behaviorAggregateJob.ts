/**
 * behaviorAggregateJob.ts — Nightly Behavior Summary Rollup
 *
 * Cron: "30 20 * * *" UTC = 02:00 IST.
 * Two passes per nightly run:
 *
 *   1. Per-day per-user counters: aggregates the prior calendar day's
 *      behavior_events documents from MongoDB into user_behavior_summary
 *      rows (one per user per day). Also bins event timestamps into a
 *      24-int hourly_activity_hist for behaviour-based matching.
 *
 *   2. Per-user reputation rollup: computes the 5 trust signals (response
 *      rate, message response rate, avg response time hours, ghost count,
 *      consistency score) over rolling windows and upserts one row per
 *      user into user_reputation_signals for the Reputation Score
 *      classifier.
 *
 * Skipped in mock-mode (shouldUseMockMongo) — both passes.
 */

import { Worker, Queue } from 'bullmq';
import { and, eq, gte, sql } from 'drizzle-orm';
import { connection } from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import {
  matchRequests,
  profiles,
  userBehaviorSummary,
  userReputationSignals,
} from '@smartshaadi/db';
import { BehaviorEvent } from '../infrastructure/mongo/models/BehaviorEvent.js';
import { Chat } from '../infrastructure/mongo/models/Chat.js';
import { shouldUseMockMongo } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const QUEUE_NAME = 'behavior-aggregate-nightly';
const REPEAT_KEY = 'behavior-aggregate-cron';
const CRON_UTC   = '30 20 * * *';

const GHOST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MSG_RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESPONSE_TIME_CAP_HOURS = 72;
const CONSISTENCY_WINDOW_DAYS = 30;

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
  hourlyHist:          number[];
}

function classify(route: string): keyof Omit<Bucket, 'userId' | 'totalRequestCount' | 'hourlyHist'> | null {
  if (/\/profiles\/[^/]+\/photos/.test(route))                  return 'photoExpansionCount';
  if (/\/profiles\/(matches|[^/]+)$/.test(route))               return 'profileViewCount';
  if (/\/matchmaking\/(feed|search)/.test(route))               return 'browseQueryCount';
  if (/\/chat\/(messages|rooms)/.test(route))                   return 'messageCount';
  return null;
}

async function aggregatePerDay(start: Date, end: Date, day: string): Promise<number> {
  const events = await BehaviorEvent.find({
    ts: { $gte: start, $lt: end },
  })
    .select({ userId: 1, route: 1, ts: 1 })
    .lean<Array<{ userId: string; route: string; ts: Date }>>();

  const byUser = new Map<string, Bucket>();
  for (const ev of events) {
    let bucket = byUser.get(ev.userId);
    if (!bucket) {
      bucket = {
        userId:              ev.userId,
        profileViewCount:    0,
        browseQueryCount:    0,
        messageCount:        0,
        photoExpansionCount: 0,
        totalRequestCount:   0,
        hourlyHist:          new Array<number>(24).fill(0),
      };
      byUser.set(ev.userId, bucket);
    }
    bucket.totalRequestCount += 1;
    const hour = new Date(ev.ts).getUTCHours();
    if (hour >= 0 && hour < 24) bucket.hourlyHist[hour] = (bucket.hourlyHist[hour] ?? 0) + 1;
    const slot = classify(ev.route);
    if (slot) bucket[slot] += 1;
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
        hourlyActivityHist:  b.hourlyHist,
      })
      .onConflictDoUpdate({
        target: [userBehaviorSummary.userId, userBehaviorSummary.day],
        set: {
          profileViewCount:    b.profileViewCount,
          browseQueryCount:    b.browseQueryCount,
          messageCount:        b.messageCount,
          photoExpansionCount: b.photoExpansionCount,
          totalRequestCount:   b.totalRequestCount,
          hourlyActivityHist:  b.hourlyHist,
          updatedAt:           sql`now()`,
        },
      });
    upserted += 1;
  }
  logger.info({ day, users: upserted, events: events.length }, '[behaviorAggregate] per-day done');
  return upserted;
}

interface ReputationCounts {
  responseRate:           number;
  messageResponseRate:    number;
  avgResponseTimeHours:   number;
  ghostCount:             number;
}

async function computeForProfile(profileId: string, now: Date): Promise<ReputationCounts> {
  const thirtyDaysAgo = new Date(now.getTime() - CONSISTENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const receivedRows = await db
    .select({ status: matchRequests.status })
    .from(matchRequests)
    .where(and(eq(matchRequests.receiverId, profileId), gte(matchRequests.createdAt, thirtyDaysAgo)));
  const totalReceived = receivedRows.length;
  const accepted = receivedRows.filter((r) => r.status === 'ACCEPTED').length;
  const responseRate = totalReceived > 0 ? accepted / totalReceived : 0;

  const oneDayAgo = new Date(now.getTime() - MSG_RESPONSE_WINDOW_MS);
  const sevenDaysAgo = new Date(now.getTime() - GHOST_WINDOW_MS);

  const chats = await Chat.find({ participants: profileId })
    .select({ participants: 1, messages: 1 })
    .lean<Array<{
      participants: string[];
      messages: Array<{ senderId: string; sentAt: Date }>;
    }>>();

  let received24h = 0;
  let replied24h = 0;
  let responseTimeSumHours = 0;
  let responseTimeCount = 0;
  let ghostCount = 0;

  for (const chat of chats) {
    const msgs = (chat.messages ?? []).filter((m) => m.sentAt != null);
    msgs.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || new Date(lastMsg.sentAt) < sevenDaysAgo) {
      ghostCount += 1;
    }

    for (const m of msgs) {
      const sentAt = new Date(m.sentAt);
      if (sentAt < oneDayAgo) continue;
      if (m.senderId === profileId) replied24h += 1;
      else received24h += 1;
    }

    let lastOtherTime: number | null = null;
    for (const m of msgs) {
      const t = new Date(m.sentAt).getTime();
      if (m.senderId !== profileId) {
        if (lastOtherTime == null) lastOtherTime = t;
      } else if (lastOtherTime != null) {
        const gapHours = Math.min((t - lastOtherTime) / (60 * 60 * 1000), RESPONSE_TIME_CAP_HOURS);
        if (gapHours >= 0) {
          responseTimeSumHours += gapHours;
          responseTimeCount += 1;
        }
        lastOtherTime = null;
      }
    }
  }

  const messageResponseRate = received24h > 0 ? Math.min(1, replied24h / received24h) : 0;
  const avgResponseTimeHours =
    responseTimeCount > 0 ? responseTimeSumHours / responseTimeCount : RESPONSE_TIME_CAP_HOURS / 2;

  return { responseRate, messageResponseRate, avgResponseTimeHours, ghostCount };
}

async function computeConsistencyByUserId(userId: string, now: Date): Promise<number> {
  const thirtyDaysAgo = new Date(now.getTime() - CONSISTENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ total: userBehaviorSummary.totalRequestCount })
    .from(userBehaviorSummary)
    .where(
      and(
        eq(userBehaviorSummary.userId, userId),
        gte(userBehaviorSummary.day, thirtyDaysAgo.toISOString().slice(0, 10)),
      ),
    );
  if (rows.length < 2) return 0.5;
  const values = rows.map((r) => r.total);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
  const stddev = Math.sqrt(variance);
  // Coefficient of variation, capped at 1.0, then inverted: low stddev
  // relative to mean → high consistency.
  const cv = mean > 0 ? Math.min(stddev / mean, 1) : 1;
  return 1 - cv;
}

async function aggregateReputation(now: Date): Promise<number> {
  const rows = await db
    .select({ id: profiles.id, userId: profiles.userId })
    .from(profiles);

  let upserted = 0;
  for (const p of rows) {
    try {
      const counts = await computeForProfile(p.id, now);
      const consistency = await computeConsistencyByUserId(p.userId, now);

      await db
        .insert(userReputationSignals)
        .values({
          userId:               p.userId,
          responseRate:         counts.responseRate.toFixed(4),
          messageResponseRate:  counts.messageResponseRate.toFixed(4),
          avgResponseTimeHours: counts.avgResponseTimeHours.toFixed(2),
          ghostCount:           counts.ghostCount,
          consistencyScore:     consistency.toFixed(4),
        })
        .onConflictDoUpdate({
          target: userReputationSignals.userId,
          set: {
            responseRate:         counts.responseRate.toFixed(4),
            messageResponseRate:  counts.messageResponseRate.toFixed(4),
            avgResponseTimeHours: counts.avgResponseTimeHours.toFixed(2),
            ghostCount:           counts.ghostCount,
            consistencyScore:     consistency.toFixed(4),
            lastComputedAt:       sql`now()`,
          },
        });
      upserted += 1;
    } catch (e) {
      logger.warn({ err: e, userId: p.userId }, '[behaviorAggregate] reputation rollup failed');
    }
  }
  logger.info({ users: upserted }, '[behaviorAggregate] reputation rollup done');
  return upserted;
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

      const dayUsers = await aggregatePerDay(start, end, day);
      const repUsers = await aggregateReputation(now);

      return { day, dayUsers, repUsers };
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
