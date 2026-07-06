/**
 * Smart Shaadi — Embedding sync (Postgres pgvector)
 *
 * The 768-dim profile embedding canonically lives in Mongo
 * `ProfileContent.aiEmbedding`. These helpers mirror it into the indexed
 * `profiles.ai_embedding` pgvector column (migrations 0029 + 0030) so matching
 * can run cosine search in Postgres instead of pulling vectors per-candidate.
 *
 * The generator now lives in the ai-service (POST /ai/embedding/profile, local
 * sentence-transformer). `jobs/embeddingGenerationJob.ts` produces a vector and
 * calls `syncProfileEmbedding`; `backfillEmbeddingsFromMongo` mirrors any
 * already-generated Mongo vectors into Postgres.
 */
import { eq, inArray } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { shouldUseMockMongo } from '../lib/env.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import { resolveProfileId } from '../lib/profile.js';
import { queueEmbeddingGeneration } from '../infrastructure/redis/queues.js';

export const EMBEDDING_DIMS = 768;

/**
 * Best-effort: enqueue a profile embedding refresh for a userId. Resolves the
 * profileId and adds a de-duped Bull job. Never throws — embedding freshness is
 * a non-critical enhancement, so a missing profile / down Redis just skips it.
 * Call after any profile-content change.
 */
export async function enqueueEmbeddingRefresh(userId: string): Promise<void> {
  try {
    const profileId = await resolveProfileId(userId);
    if (!profileId) return;
    await queueEmbeddingGeneration({ userId, profileId });
  } catch {
    /* non-critical */
  }
}

/** Write one profile's embedding into the indexed pgvector column. */
export async function syncProfileEmbedding(profileId: string, embedding: number[]): Promise<void> {
  if (embedding.length !== EMBEDDING_DIMS) {
    throw new Error(`embedding must be ${EMBEDDING_DIMS}-dim, got ${embedding.length}`);
  }
  await db
    .update(profiles)
    .set({ aiEmbedding: embedding, embeddingUpdatedAt: new Date() })
    .where(eq(profiles.id, profileId));
}

interface EmbeddingDoc {
  userId: string;
  aiEmbedding?: number[];
}

/**
 * Backfill Postgres from any ProfileContent docs that already hold an embedding.
 * Mock-guarded (Rule 11) — no-op in mock mode (Mongo not connected). Resolves
 * Mongo's userId → profiles.id (Rule 12 boundary) in one batched query. Returns
 * the number of profiles synced. No-op today: nothing writes aiEmbedding yet.
 */
export async function backfillEmbeddingsFromMongo(): Promise<number> {
  if (shouldUseMockMongo) return 0;

  const model = ProfileContent as unknown as {
    find: (filter: object, proj?: object) => { lean: () => Promise<EmbeddingDoc[]> };
  };
  const docs = await model
    .find({ aiEmbedding: { $exists: true, $ne: [] } }, { userId: 1, aiEmbedding: 1 })
    .lean();
  if (docs.length === 0) return 0;

  const userIds = docs.map((d) => d.userId).filter((u): u is string => !!u);
  const rows = await db
    .select({ id: profiles.id, userId: profiles.userId })
    .from(profiles)
    .where(inArray(profiles.userId, userIds));
  const profileIdByUser = new Map(rows.map((r) => [r.userId, r.id]));

  let synced = 0;
  for (const doc of docs) {
    const profileId = profileIdByUser.get(doc.userId);
    const embedding = doc.aiEmbedding;
    if (!profileId || !embedding || embedding.length !== EMBEDDING_DIMS) continue;
    await syncProfileEmbedding(profileId, embedding);
    synced++;
  }
  return synced;
}
