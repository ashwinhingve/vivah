import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { callAiService } from '../lib/ai.js';
import { env } from '../lib/env.js';
import type { MatchComputeJob } from '../infrastructure/redis/queues.js';

const GUNA_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface GunaApiResponse {
  total_score: number;
}

export function startGunaRecalcWorker(): Worker<MatchComputeJob> {
  return new Worker<MatchComputeJob>(
    'queue:match-compute',
    async (job) => {
      // Sort IDs alphabetically — must match scorer.ts key convention
      const [idA, idB] = [job.data.profileAId, job.data.profileBId].sort();

      const result = await callAiService<GunaApiResponse>('/ai/horoscope/guna', {
        profile_a: { id: idA },
        profile_b: { id: idB },
      });

      const key = `match_scores:${idA}:${idB}`;
      await redis.setex(key, GUNA_TTL_SECONDS, String(result.total_score));
    },
    { connection: { url: env.REDIS_URL } },
  );
}
