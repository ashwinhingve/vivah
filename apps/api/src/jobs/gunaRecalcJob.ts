import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { redis } from '../lib/redis.js';
import { db } from '../lib/db.js';
import { callAiService } from '../lib/ai.js';
import { getMyProfileContent } from '../profiles/content.service.js';
import { connection, type MatchComputeJob } from '../infrastructure/redis/queues.js';
import {
  normalizeRashi,
  normalizeNakshatra,
  normalizeManglik,
  type ManglikStatus,
} from '../lib/horoscope.js';

// 7d — Guna scores are deterministic per-pair Vedic math; no need to refresh
// faster than the weekly match-score cycle described in CLAUDE.md.
const GUNA_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const NEUTRAL_SCORE = 18; // guna-milan midpoint when horoscope data is missing

interface GunaApiResponse {
  total_score: number;
}

// Rashi/nakshatra normalisation moved to lib/horoscope.ts — it is shared with
// the user-facing Guna endpoint, which previously did not translate at all.

interface Horoscope { rashi: string; nakshatra: string; manglik: ManglikStatus }
interface Chart { horoscope: Horoscope; gender: string | null }

async function loadChart(profileId: string): Promise<Chart | null> {
  const [row] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!row) return null;
  const content = (await getMyProfileContent(row.userId)) as {
    horoscope?: { rashi?: unknown; nakshatra?: unknown; manglik?: unknown };
    personal?:  { gender?: string };
  } | null;
  const h = content?.horoscope;
  // Normalisation is shared with the user-facing endpoint (lib/horoscope.ts) so
  // the two paths cannot drift into disagreeing about the same pair.
  const rashi     = normalizeRashi(h?.rashi);
  const nakshatra = normalizeNakshatra(h?.nakshatra);
  if (!rashi || !nakshatra) return null;
  return {
    horoscope: { rashi, nakshatra, manglik: normalizeManglik(h?.manglik) },
    gender:    content?.personal?.gender ?? null,
  };
}

export function startGunaRecalcWorker(): { close(): Promise<void> } {
  // Match compute (Guna Milan scoring) — low concurrency (3) because it calls
  // the AI service synchronously and is compute-heavy per pair. Higher concurrency
  // would starve other queues and overwhelm the AI service.
  const w = new Worker<MatchComputeJob>(
    'match-compute',
    async (job) => {
      // Sort IDs alphabetically — must match scorer.ts key convention.
      // NOTE this is the CACHE KEY only. It is deliberately not the argument
      // order to the calculator; see below.
      const [idA, idB] = [job.data.profileAId, job.data.profileBId].sort() as [string, string];

      const [a, b] = await Promise.all([loadChart(idA), loadChart(idB)]);
      const key = `match_scores:${idA}:${idB}`;
      if (!a || !b) {
        // Horoscope missing on one side — park the neutral score so the
        // scorer stops treating this pair as pending forever.
        await redis.setex(key, GUNA_TTL_SECONDS, String(NEUTRAL_SCORE));
        return;
      }

      // Guna Milan is ORDER-SENSITIVE: Varna scores when the boy's rank >= the
      // girl's, and Tara is counted girl -> boy. Feeding it two alphabetically
      // sorted ids meant roughly half of all pairs were scored with the groom
      // and bride reversed — a stable number, but the wrong one. Measured on
      // real data, the reversal moved a pair from 15/36 to 14/36 by zeroing
      // Varna.
      //
      // Order groom-first. When the pair is not one MALE and one FEMALE
      // (gender missing, NON_BINARY, OTHER, same-gender) the classical rule
      // does not apply, so keep the sorted order: arbitrary, but stable, which
      // is what the shared cache entry needs.
      const groomFirst =
        b.gender === 'MALE' && a.gender === 'FEMALE'
          ? ([b, a] as const)
          : ([a, b] as const);

      const result = await callAiService<GunaApiResponse>('/ai/horoscope/guna', {
        profile_a: groomFirst[0].horoscope,
        profile_b: groomFirst[1].horoscope,
      });

      await redis.setex(key, GUNA_TTL_SECONDS, String(result.total_score));
    },
    { connection, concurrency: 3 },
  );
  return { close: () => w.close() };
}
