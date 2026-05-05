/**
 * Smart Shaadi — Nightly Emotional Score Batch Job
 *
 * Cron: "0 21 * * *" UTC = 2am IST.
 * Fetches all ACCEPTED matches with chat activity in last 30 days,
 * scores each via ai-service, and stores results in Redis (25h TTL).
 * Concurrency limit of 5 to avoid overwhelming ai-service.
 */
import { Worker } from 'bullmq';
import { Queue } from 'bullmq';
import { eq, and, gt } from 'drizzle-orm';
import { connection } from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import { matchRequests } from '@smartshaadi/db';
import { redis } from '../lib/redis.js';
import { env } from '../lib/env.js';
import { getEmotionalScore } from '../services/aiService.js';

const QUEUE_NAME   = 'emotional-score-nightly';
const REPEAT_KEY   = 'emotional-score-nightly-cron';
const CRON_UTC     = '0 21 * * *'; // 2am IST
const CACHE_TTL    = 25 * 3600;    // 25h
const SEVEN_DAY_S  = 7 * 24 * 3600;
const CONCURRENCY  = 5;

export interface EmotionalScoreNightlyJob {
  scheduledAt: string;
}

export const emotionalScoreQueue = new Queue<EmotionalScoreNightlyJob>(
  QUEUE_NAME,
  { connection },
);

export function registerEmotionalScoreWorker(): Worker<EmotionalScoreNightlyJob> {
  const worker = new Worker<EmotionalScoreNightlyJob>(
    QUEUE_NAME,
    async (job) => {
      const startMs = Date.now();
      console.info(`[emotionalScoreJob] starting batch at ${job.data.scheduledAt}`);

      // All ACCEPTED matches — fetch all for nightly sweep
      const matches = await db
        .select({ id: matchRequests.id })
        .from(matchRequests)
        .where(
          and(
            eq(matchRequests.status, 'ACCEPTED'),
            gt(matchRequests.updatedAt, new Date(Date.now() - 30 * 24 * 3600 * 1000)),
          ),
        );

      let processed = 0;
      let failed    = 0;

      // Process in batches of CONCURRENCY
      for (let i = 0; i < matches.length; i += CONCURRENCY) {
        const batch = matches.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          batch.map(async ({ id: matchId }) => {
            try {
              // Fetch last 20 messages from internal chat endpoint
              let messages: Array<{ sender: 'A' | 'B'; text: string; timestamp: string }> = [];
              try {
                const internalBase = env.API_BASE_URL ?? 'http://localhost:4000';
                const msgRes = await fetch(
                  `${internalBase}/internal/chat/${matchId}/messages?limit=20`,
                  {
                    headers: { 'X-Internal-Key': env.AI_SERVICE_INTERNAL_KEY },
                    signal: AbortSignal.timeout(5_000),
                  },
                );
                if (msgRes.ok) {
                  const body = await msgRes.json() as { data?: { messages?: typeof messages } };
                  messages = body.data?.messages ?? [];
                }
              } catch {
                // Skip message fetch errors — score with empty list (returns STEADY/stable)
              }

              // Get 7-day historical avg if available
              let historicalAvg: number | null = null;
              try {
                const avgRaw = await redis.get(`emotional:${matchId}:7day_avg`);
                if (avgRaw) historicalAvg = parseFloat(avgRaw);
              } catch { /* non-fatal */ }

              const scoreResult = await getEmotionalScore(matchId, messages, historicalAvg);

              // Store with 25h TTL
              await redis.set(
                `emotional:${matchId}`,
                JSON.stringify(scoreResult),
                'EX',
                CACHE_TTL,
              );

              // Update 7-day rolling avg
              const nowMs    = Date.now();
              const cutoffMs = nowMs - SEVEN_DAY_S * 1000;
              const avgZKey  = `emotional:${matchId}:7day_scores`;
              await redis.zadd(avgZKey, nowMs, `${nowMs}:${scoreResult.score}`);
              await redis.zremrangebyscore(avgZKey, '-inf', cutoffMs);

              const allMembers = await redis.zrange(avgZKey, 0, -1);
              if (allMembers.length > 0) {
                const scores = allMembers.map((m) => {
                  const parts = (m as string).split(':');
                  return parseFloat(parts[1] ?? '50');
                });
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                await redis.set(
                  `emotional:${matchId}:7day_avg`,
                  avg.toFixed(2),
                  'EX',
                  SEVEN_DAY_S,
                );
              }

              processed++;
            } catch {
              failed++;
            }
          }),
        );
      }

      const durationMs = Date.now() - startMs;
      console.info(
        `[emotionalScoreJob] done — processed=${processed} failed=${failed} duration=${durationMs}ms`,
      );
      return { processed, failed, durationMs };
    },
    { connection, concurrency: 1 }, // outer concurrency=1; inner batch controls parallelism
  );

  worker.on('failed', (job, jobErr) => {
    console.error(`[emotionalScoreJob] job ${job?.id} failed:`, jobErr);
  });

  return worker;
}

/**
 * Schedules the nightly cron job. Idempotent on repeated boot.
 */
export async function scheduleEmotionalScoreJob(): Promise<void> {
  await emotionalScoreQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { pattern: CRON_UTC },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}
