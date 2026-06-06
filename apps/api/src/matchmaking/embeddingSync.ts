/**
 * Smart Shaadi — Embedding sync (Postgres pgvector)
 *
 * The 1536-dim profile embedding canonically lives in Mongo
 * `ProfileContent.aiEmbedding`. These helpers mirror it into the indexed
 * `profiles.ai_embedding` pgvector column (migration 0029) so matching can run
 * cosine search in Postgres instead of pulling vectors per-candidate.
 *
 * NOTE: no embedding generator exists yet — nothing writes
 * `ProfileContent.aiEmbedding` today, so `backfillEmbeddingsFromMongo` is a no-op
 * until that lands. `syncProfileEmbedding` is the integration point a future
 * generator calls after producing a vector. Not wired into any request path.
 */
import { eq, inArray } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { shouldUseMockMongo } from '../lib/env.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';

export const EMBEDDING_DIMS = 1536;

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
