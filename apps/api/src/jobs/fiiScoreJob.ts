/**
 * Smart Shaadi — Nightly FII (Family Inclination Index) Refresh Job
 *
 * Cron: "30 21 * * *" UTC = 3:30am IST (staggered after Emotional 2am, DPI 3am).
 * Phase 1:  Recompute individual FII scores for profiles active in last 7 days.
 * Phase 2:  Pre-warm template-path compatibility cache for ACCEPTED matches.
 *
 * NEVER calls LLM in batch — too expensive. Template path only.
 * Concurrency: 5 (template path is fast <50ms per pair).
 */
import { Worker, Queue } from 'bullmq';
import { eq, and, gt, or } from 'drizzle-orm';
import { connection } from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import { profiles, matchRequests } from '@smartshaadi/db';
import { redis } from '../lib/redis.js';
import { extractFiiSignals, computeFiiScoreFromSignals } from '../services/fiiScore.js';
import { getFiiCompatibility } from '../services/aiService.js';

const QUEUE_NAME          = 'dpi-refresh-nightly'; // reuse existing queue
const REPEAT_KEY          = 'fii-refresh-nightly-cron';
const CRON_UTC            = '30 21 * * *';           // 3:30am IST
// AI-inference standard is 1h; FII mirrors the 24h cache used in the route
// (trait-level signal, low drift). MIN_TTL is a refresh-skip floor, not a TTL.
const CACHE_TTL_SEC       = 86400;                   // 24h — matches route FII_CACHE_TTL_SEC
const CACHE_MIN_TTL_SEC   = 12 * 3600;              // skip if still fresh (12h)
const SCORE_CACHE_TTL_SEC = 86400;                   // 24h — matches route FII_SCORE_CACHE_TTL_SEC
const CONCURRENCY         = 5;
const SEVEN_DAYS_MS       = 7 * 24 * 3600 * 1000;

export interface FiiRefreshNightlyJob {
  scheduledAt: string;
}

// Use the existing shared queue so we don't spin up a new Redis connection
export const fiiRefreshQueue = new Queue<FiiRefreshNightlyJob>(QUEUE_NAME, { connection });

export function registerFiiRefreshWorker(): Worker<FiiRefreshNightlyJob> {
  const worker = new Worker<FiiRefreshNightlyJob>(
    QUEUE_NAME,
    async (job) => {
      const startMs = Date.now();
      console.info(`[fiiScoreJob] starting batch at ${job.data.scheduledAt}`);

      // ── Phase 1: Recompute individual scores for recently active profiles ──
      const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
      const activeProfiles = await db
        .select({ id: profiles.id, userId: profiles.userId })
        .from(profiles)
        .where(
          and(
            eq(profiles.isActive, true),
            gt(profiles.lastActiveAt, cutoff),
          ),
        );

      let scoreProcessed = 0;
      let scoreFailed    = 0;

      for (let i = 0; i < activeProfiles.length; i += CONCURRENCY) {
        const batch = activeProfiles.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          batch.map(async ({ id: profileId, userId }) => {
            try {
              const scoreCacheKey = `fii:profile:${profileId}`;

              // Skip if still fresh
              try {
                const ttl = await redis.ttl(scoreCacheKey);
                if (ttl > CACHE_MIN_TTL_SEC) {
                  scoreProcessed++;
                  return;
                }
              } catch {
                // Redis unavailable — proceed
              }

              const signals = await extractFiiSignals(userId);
              const score   = computeFiiScoreFromSignals(signals);

              // Write to Postgres
              await db
                .update(profiles)
                .set({ familyInclinationScore: score })
                .where(eq(profiles.id, profileId));

              // Cache 24h
              const result = { score, label: fiiLabelBand(score), breakdown: signals };
              await redis.set(scoreCacheKey, JSON.stringify(result), 'EX', SCORE_CACHE_TTL_SEC);

              scoreProcessed++;
            } catch {
              scoreFailed++;
            }
          }),
        );
      }

      // ── Phase 2: Pre-warm template compatibility for ACCEPTED matches ──────
      const matchTasks: Array<{
        userIdA: string;
        userIdB: string;
        matchId: string;
      }> = [];

      for (const profile of activeProfiles) {
        const matches = await db
          .select({
            id:         matchRequests.id,
            senderId:   matchRequests.senderId,
            receiverId: matchRequests.receiverId,
          })
          .from(matchRequests)
          .where(
            and(
              eq(matchRequests.status, 'ACCEPTED'),
              or(
                eq(matchRequests.senderId, profile.id),
                eq(matchRequests.receiverId, profile.id),
              ),
            ),
          );

        for (const m of matches) {
          const otherProfileId =
            m.senderId === profile.id ? m.receiverId : m.senderId;

          // Avoid duplicate pairs (both sides appear in activeProfiles)
          if (m.senderId !== profile.id) continue;

          const [otherPg] = await db
            .select({ userId: profiles.userId })
            .from(profiles)
            .where(eq(profiles.id, otherProfileId))
            .limit(1);

          if (otherPg) {
            matchTasks.push({
              userIdA: profile.userId,
              userIdB: otherPg.userId,
              matchId: m.id,
            });
          }
        }
      }

      let compatProcessed = 0;
      let compatSkipped   = 0;
      let compatFailed    = 0;

      for (let i = 0; i < matchTasks.length; i += CONCURRENCY) {
        const batch = matchTasks.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          batch.map(async ({ userIdA, userIdB, matchId }) => {
            try {
              const cacheKey = `fii:match:${matchId}:template`;

              // Skip if still fresh
              try {
                const ttl = await redis.ttl(cacheKey);
                if (ttl > CACHE_MIN_TTL_SEC) {
                  compatSkipped++;
                  return;
                }
              } catch {
                // Redis unavailable — proceed
              }

              const [signalsA, signalsB] = await Promise.all([
                extractFiiSignals(userIdA),
                extractFiiSignals(userIdB),
              ]);

              // Template path only (useLlmNarrative=false) — never call LLM in batch
              const result = await getFiiCompatibility(
                signalsA,
                signalsB,
                'Profile A',
                'Profile B',
                false,
              );

              await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SEC);
              compatProcessed++;
            } catch {
              compatFailed++;
            }
          }),
        );
      }

      const durationMs = Date.now() - startMs;
      console.info(
        `[fiiScoreJob] done — scores: ${scoreProcessed} processed, ${scoreFailed} failed; ` +
        `compat: ${compatProcessed} processed, ${compatSkipped} skipped, ${compatFailed} failed; ` +
        `durationMs: ${durationMs}`,
      );
      return { scoreProcessed, scoreFailed, compatProcessed, compatSkipped, compatFailed, durationMs };
    },
    { connection, concurrency: 1 }, // outer concurrency=1; inner batch controls parallelism
  );

  worker.on('failed', (job, jobErr) => {
    console.error(`[fiiScoreJob] job ${job?.id} failed:`, jobErr);
  });

  return worker;
}

/**
 * Schedule the nightly FII cron job. Idempotent on repeated boot.
 */
export async function scheduleFiiRefreshJob(): Promise<void> {
  await fiiRefreshQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { pattern: CRON_UTC },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}

function fiiLabelBand(score: number): string {
  if (score >= 80) return 'Very High Family Inclination';
  if (score >= 60) return 'High Family Inclination';
  if (score >= 40) return 'Moderate Family Inclination';
  if (score >= 20) return 'Low Family Inclination';
  return 'Minimal Family Inclination';
}
