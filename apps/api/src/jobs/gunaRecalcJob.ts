import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { redis } from '../lib/redis.js';
import { db } from '../lib/db.js';
import { callAiService } from '../lib/ai.js';
import { getMyProfileContent } from '../profiles/content.service.js';
import { connection, type MatchComputeJob } from '../infrastructure/redis/queues.js';

const GUNA_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const NEUTRAL_SCORE = 18; // guna-milan midpoint when horoscope data is missing

interface GunaApiResponse {
  total_score: number;
}

// DB enum values (UPPERCASE_UNDERSCORE) → Sanskrit spellings the Python
// calculator keys on. Anything else (or missing) means we can't compute a
// guna score and should fall back to the neutral midpoint.
const RASHI_MAP: Record<string, string> = {
  MESH: 'Mesha', VRISHABHA: 'Vrishabha', MITHUN: 'Mithuna', KARK: 'Karka',
  SINGH: 'Simha', KANYA: 'Kanya', TULA: 'Tula', VRISHCHIK: 'Vrishchika',
  DHANU: 'Dhanu', MAKAR: 'Makara', KUMBH: 'Kumbha', MEEN: 'Meena',
};

const NAKSHATRA_MAP: Record<string, string> = {
  ASHWINI: 'Ashwini', BHARANI: 'Bharani', KRITTIKA: 'Krittika', ROHINI: 'Rohini',
  MRIGASHIRA: 'Mrigashira', ARDRA: 'Ardra', PUNARVASU: 'Punarvasu', PUSHYA: 'Pushya',
  ASHLESHA: 'Ashlesha', MAGHA: 'Magha', PURVA_PHALGUNI: 'Purva Phalguni',
  UTTARA_PHALGUNI: 'Uttara Phalguni', HASTA: 'Hasta', CHITRA: 'Chitra',
  SWATI: 'Swati', VISHAKHA: 'Vishakha', ANURADHA: 'Anuradha', JYESHTHA: 'Jyeshtha',
  MULA: 'Mula', PURVA_ASHADHA: 'Purva Ashadha', UTTARA_ASHADHA: 'Uttara Ashadha',
  SHRAVANA: 'Shravana', DHANISHTA: 'Dhanishtha', SHATABHISHA: 'Shatabhisha',
  PURVA_BHADRAPADA: 'Purva Bhadrapada', UTTARA_BHADRAPADA: 'Uttara Bhadrapada',
  REVATI: 'Revati',
};

interface Horoscope { rashi: string; nakshatra: string; manglik: boolean }

async function loadHoroscope(profileId: string): Promise<Horoscope | null> {
  const [row] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!row) return null;
  const content = (await getMyProfileContent(row.userId)) as {
    horoscope?: { rashi?: string | null; nakshatra?: string | null; manglik?: string | null };
  } | null;
  const h = content?.horoscope;
  if (!h?.rashi || !h.nakshatra) return null;
  const rashi     = RASHI_MAP[h.rashi];
  const nakshatra = NAKSHATRA_MAP[h.nakshatra];
  if (!rashi || !nakshatra) return null;
  return { rashi, nakshatra, manglik: h.manglik === 'YES' };
}

export function startGunaRecalcWorker(): Worker<MatchComputeJob> {
  return new Worker<MatchComputeJob>(
    'match-compute',
    async (job) => {
      // Sort IDs alphabetically — must match scorer.ts key convention
      const [idA, idB] = [job.data.profileAId, job.data.profileBId].sort() as [string, string];

      const [a, b] = await Promise.all([loadHoroscope(idA), loadHoroscope(idB)]);
      const key = `match_scores:${idA}:${idB}`;
      if (!a || !b) {
        // Horoscope missing on one side — park the neutral score so the
        // scorer stops treating this pair as pending forever.
        await redis.setex(key, GUNA_TTL_SECONDS, String(NEUTRAL_SCORE));
        return;
      }

      const result = await callAiService<GunaApiResponse>('/ai/horoscope/guna', {
        profile_a: a,
        profile_b: b,
      });

      await redis.setex(key, GUNA_TTL_SECONDS, String(result.total_score));
    },
    { connection },
  );
}
