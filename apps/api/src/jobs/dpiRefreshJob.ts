/**
 * Smart Shaadi — Nightly DPI (Divorce Probability Indicator) Refresh Job
 *
 * Cron: "0 21 * * *" UTC = 3am IST (runs after Emotional Score 2am job).
 * Fetches users active in last 7 days, computes DPI for each ACCEPTED match
 * from each user's perspective, and caches results in Redis (24h TTL).
 * Concurrency: 3 (Opus 4.7 is slower than Sonnet).
 */
import { Worker, Queue } from 'bullmq';
import { eq, and, gt, or } from 'drizzle-orm';
import { connection } from '../infrastructure/redis/queues.js';
import { db } from '../lib/db.js';
import { profiles, matchRequests } from '@smartshaadi/db';
import { redis } from '../lib/redis.js';
import { env } from '../lib/env.js';
import { getDivorceProbability } from '../services/aiService.js';
import { buildCacheKey } from '../services/dpiPrivacy.js';
import { extractFeatures, type DpiProfile, type DpiProfileContent } from '../services/dpiFeatures.js';
import { ProfileContent as _ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import type { Model } from 'mongoose';

interface IProfileContentModel extends Model<Record<string, unknown>> {}
const ProfileContent = _ProfileContent as unknown as IProfileContentModel;

const QUEUE_NAME     = 'dpi-refresh-nightly';
const REPEAT_KEY     = 'dpi-refresh-nightly-cron';
const CRON_UTC       = '0 21 * * *'; // 3am IST
const CACHE_TTL_SEC  = 86400;        // 24h
const CACHE_MIN_TTL  = 12 * 3600;   // 12h — skip if still fresh
const CONCURRENCY    = 3;
const SEVEN_DAYS_MS  = 7 * 24 * 3600 * 1000;

export interface DpiRefreshNightlyJob {
  scheduledAt: string;
}

export const dpiRefreshQueue = new Queue<DpiRefreshNightlyJob>(QUEUE_NAME, { connection });

export function registerDpiRefreshWorker(): Worker<DpiRefreshNightlyJob> {
  const worker = new Worker<DpiRefreshNightlyJob>(
    QUEUE_NAME,
    async (job) => {
      const startMs = Date.now();
      console.info(`[dpiRefreshJob] starting batch at ${job.data.scheduledAt}`);

      // ── Step 1: Get recently active users (last 7 days) ──────────────────
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

      // ── Step 2: For each active user, fetch ACCEPTED matches ─────────────
      // Build a flat list of (userId, profileId, matchId, otherProfileId) tuples
      const tasks: Array<{
        userId: string;
        profileId: string;
        matchId: string;
        otherProfileId: string;
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
          tasks.push({
            userId: profile.userId,
            profileId: profile.id,
            matchId: m.id,
            otherProfileId,
          });
        }
      }

      let processed = 0;
      let skipped   = 0;
      let failed    = 0;

      // ── Step 3: Process in batches of CONCURRENCY ─────────────────────────
      for (let i = 0; i < tasks.length; i += CONCURRENCY) {
        const batch = tasks.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          batch.map(async ({ userId, profileId, matchId, otherProfileId }) => {
            try {
              // Skip if cache key still fresh (TTL > 12h)
              const cacheKey = buildCacheKey(userId, matchId);
              try {
                const ttl = await redis.ttl(cacheKey);
                if (ttl > CACHE_MIN_TTL) {
                  skipped++;
                  return;
                }
              } catch {
                // Redis unavailable — proceed to compute
              }

              // Fetch both PG profiles
              const [pgA] = await db
                .select({
                  id:        profiles.id,
                  userId:    profiles.userId,
                  latitude:  profiles.latitude,
                  longitude: profiles.longitude,
                })
                .from(profiles)
                .where(eq(profiles.id, profileId))
                .limit(1);

              const [pgB] = await db
                .select({
                  id:        profiles.id,
                  userId:    profiles.userId,
                  latitude:  profiles.latitude,
                  longitude: profiles.longitude,
                })
                .from(profiles)
                .where(eq(profiles.id, otherProfileId))
                .limit(1);

              if (!pgA || !pgB) {
                skipped++;
                return;
              }

              // Fetch MongoDB content (guard for mock mode)
              async function fetchContent(
                pgUserId: string,
              ): Promise<DpiProfileContent> {
                if (env.USE_MOCK_SERVICES) return {};
                try {
                  const content = await ProfileContent.findOne({ userId: pgUserId })
                    .select(
                      'personal.dob personal.religion education.degree profession.incomeRange ' +
                      'family.familyValues lifestyle.diet lifestyle.smoking lifestyle.drinking ' +
                      'lifestyle.interests lifestyle.hyperNicheTags horoscope.gunaScore ' +
                      'partnerPreferences communityZone',
                    )
                    .lean();
                  return (content ?? {}) as DpiProfileContent;
                } catch {
                  return {};
                }
              }

              const [contentA, contentB] = await Promise.all([
                fetchContent(pgA.userId),
                fetchContent(pgB.userId),
              ]);

              const profileA: DpiProfile = {
                id: pgA.id,
                userId: pgA.userId,
                latitude: pgA.latitude,
                longitude: pgA.longitude,
                content: contentA ?? {},
              };
              const profileB: DpiProfile = {
                id: pgB.id,
                userId: pgB.userId,
                latitude: pgB.latitude,
                longitude: pgB.longitude,
                content: contentB ?? {},
              };

              // Extract features
              const features = await extractFeatures(profileA, profileB, matchId);

              // Compute shared strengths
              const interestsA = new Set([
                ...(contentA?.lifestyle?.interests ?? []),
                ...(contentA?.lifestyle?.hyperNicheTags ?? []),
              ]);
              const interestsB = new Set([
                ...(contentB?.lifestyle?.interests ?? []),
                ...(contentB?.lifestyle?.hyperNicheTags ?? []),
              ]);
              const sharedStrengths: string[] = [];
              for (const item of interestsA) {
                if (interestsB.has(item)) sharedStrengths.push(item);
                if (sharedStrengths.length >= 5) break;
              }

              // Call AI service
              const dpiResult = await getDivorceProbability(
                userId,
                matchId,
                features,
                { a: '', b: '' }, // summaries not needed for batch refresh
                sharedStrengths,
              );

              // Cache result 24h
              await redis.set(cacheKey, JSON.stringify(dpiResult), 'EX', CACHE_TTL_SEC);
              processed++;
            } catch {
              failed++;
            }
          }),
        );
      }

      const durationMs = Date.now() - startMs;
      console.info(
        `[dpiRefreshJob] done — dpi.refresh.processed { count: ${processed}, skipped: ${skipped}, failed: ${failed}, durationMs: ${durationMs} }`,
      );
      return { processed, skipped, failed, durationMs };
    },
    { connection, concurrency: 1 }, // outer concurrency=1; inner batch controls parallelism
  );

  worker.on('failed', (job, jobErr) => {
    console.error(`[dpiRefreshJob] job ${job?.id} failed:`, jobErr);
  });

  return worker;
}

/**
 * Schedules the nightly DPI cron job. Idempotent on repeated boot.
 */
export async function scheduleDpiRefreshJob(): Promise<void> {
  await dpiRefreshQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { pattern: CRON_UTC },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}
