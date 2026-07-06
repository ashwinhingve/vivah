/**
 * Semantic "find similar matches" — vector re-ranking of the vetted feed pool.
 *
 * Design choice (correctness > cleverness): rather than run a raw pgvector scan
 * that would re-implement the safety filters, we re-rank the SAME candidate pool
 * the match feed already produces. That pool is guaranteed reciprocal (both-sides
 * preferences, Rule 10), block-filtered (both directions), and KYC-verified-only
 * (Rule 5) by the existing engine — so semantic ranking can never surface someone
 * the feed wouldn't. Embeddings are L2-normalized, so cosine similarity == dot
 * product; we compute it in JS over the small feed pool.
 *
 * Returns a descriptive similarity LABEL, never a numeric score, to avoid
 * confusion with the platform's official weighted match percentage.
 */
import { eq, inArray } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import type { MatchFeedItem } from '@smartshaadi/types';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { resolveProfileId } from '../lib/profile.js';
import { getCachedFeed, computeAndCacheFeed } from './engine.js';

export interface SimilarMatch {
  profile_id: string;
  display_name: string;
  age: number | null;
  city: string;
  similarity_label: string;
}

export interface SimilarMatchesResult {
  reason?: string;
  count: number;
  similar: SimilarMatch[];
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i]! * b[i]!;
  return sum;
}

function similarityLabel(sim: number): string {
  if (sim >= 0.75) return 'very similar interests & values';
  if (sim >= 0.55) return 'strong shared interests';
  if (sim >= 0.35) return 'some shared interests';
  return 'a few things in common';
}

export async function findSimilarMatches(
  userId: string,
  limit = 5,
): Promise<SimilarMatchesResult> {
  const profileId = await resolveProfileId(userId);
  if (!profileId) return { reason: 'profile_not_found', count: 0, similar: [] };

  const [me] = await db
    .select({ emb: profiles.aiEmbedding })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  const myEmb = (me?.emb ?? null) as number[] | null;
  if (!myEmb || myEmb.length === 0) {
    return { reason: 'embedding_not_ready', count: 0, similar: [] };
  }

  // Vetted candidate pool (reciprocal + block + verified). Reuse cache when warm.
  const pool: MatchFeedItem[] =
    (await getCachedFeed(userId, redis)) ?? (await computeAndCacheFeed(userId, db, redis));
  if (pool.length === 0) return { count: 0, similar: [] };

  const rows = await db
    .select({ id: profiles.id, emb: profiles.aiEmbedding })
    .from(profiles)
    .where(inArray(profiles.id, pool.map((p) => p.profileId)));

  const embById = new Map<string, number[]>();
  for (const r of rows) {
    const e = (r.emb ?? null) as number[] | null;
    if (e && e.length) embById.set(r.id, e);
  }

  const cap = Math.max(1, Math.min(10, limit));
  const scored = pool
    .map((item) => {
      const e = embById.get(item.profileId);
      return e ? { item, sim: dot(myEmb, e) } : null;
    })
    .filter((x): x is { item: MatchFeedItem; sim: number } => x !== null)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, cap);

  const similar: SimilarMatch[] = scored.map(({ item, sim }) => ({
    profile_id: item.profileId,
    display_name: item.name,
    age: item.age,
    city: item.city,
    similarity_label: similarityLabel(sim),
  }));

  return { count: similar.length, similar };
}
