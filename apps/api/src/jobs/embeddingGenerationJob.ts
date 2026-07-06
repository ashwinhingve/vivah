/**
 * Smart Shaadi — Profile Embedding Generation Job
 *
 * Event-driven (not cron): enqueued via queueEmbeddingGeneration whenever a
 * user's profile content changes. Assembles a redaction-safe text blob from the
 * profile (NO contact info), asks the ai-service to embed it with the local
 * sentence-transformer, then persists the 768-dim vector to Mongo
 * (ProfileContent.aiEmbedding, canonical) and mirrors it into the indexed
 * pgvector column via syncProfileEmbedding.
 *
 * Gated: the whole semantic path only matters when ASSISTANT_SEMANTIC_SEARCH_ENABLED
 * is on; the worker is cheap to run regardless and simply keeps vectors warm.
 */
import { Worker } from 'bullmq';
import type { Model } from 'mongoose';
import {
  connection,
  type EmbeddingGenerationJob,
} from '../infrastructure/redis/queues.js';
import { env } from '../lib/env.js';
import { callAiService } from '../lib/ai.js';
import { ProfileContent as _ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import { syncProfileEmbedding, EMBEDDING_DIMS } from '../matchmaking/embeddingSync.js';

const QUEUE_NAME = 'embedding-generation';

interface EmbeddingContentDoc {
  aboutMe?: string;
  partnerDescription?: string;
  personal?: { maritalStatus?: string; motherTongue?: string };
  education?: { degree?: string; field?: string };
  profession?: { jobTitle?: string; industry?: string; occupation?: string };
  lifestyle?: { diet?: string; interests?: string[]; hobbies?: string[] };
  location?: { city?: string; state?: string; country?: string };
  family?: { familyValues?: string; familyType?: string };
  communityZone?: { caste?: string; motherTongue?: string; community?: string };
}

const ProfileContent = _ProfileContent as unknown as Model<Record<string, unknown>>;

interface EmbeddingResponse {
  success?: boolean;
  data?: { profile_id: string; embedding: number[]; dims: number; available: boolean };
  // ai-service returns the model directly (not the {success,data} envelope).
  profile_id?: string;
  embedding?: number[];
  dims?: number;
  available?: boolean;
}

/** Assemble a redaction-safe text blob (never phone/email) for embedding. */
export function buildEmbeddingText(doc: EmbeddingContentDoc): string {
  const parts: string[] = [];
  const push = (v?: string | null) => {
    if (v && v.trim()) parts.push(v.trim());
  };

  push(doc.aboutMe);
  push(doc.partnerDescription);
  push(doc.personal?.maritalStatus);
  push(doc.personal?.motherTongue ?? doc.communityZone?.motherTongue);
  push(doc.education?.degree);
  push(doc.education?.field);
  push(doc.profession?.jobTitle ?? doc.profession?.occupation);
  push(doc.profession?.industry);
  push(doc.lifestyle?.diet);
  if (doc.lifestyle?.interests?.length) parts.push(doc.lifestyle.interests.join(', '));
  if (doc.lifestyle?.hobbies?.length) parts.push(doc.lifestyle.hobbies.join(', '));
  push(doc.location?.city);
  push(doc.location?.state);
  push(doc.family?.familyValues);
  push(doc.family?.familyType);
  push(doc.communityZone?.community ?? doc.communityZone?.caste);

  return parts.join('. ').slice(0, 8000);
}

export interface EmbeddingRunResult {
  generated?: boolean;
  skipped?: string;
}

/**
 * Core generation: assemble text → embed via ai-service → persist to Mongo +
 * pgvector. Shared by the Bull worker and the one-off backfill script.
 */
export async function runEmbeddingGeneration(
  userId: string,
  profileId: string,
): Promise<EmbeddingRunResult> {
  // Mongo holds the rich profile content. Skip entirely in mock mode.
  if (env.USE_MOCK_SERVICES) return { skipped: 'mock' };

  const doc = (await ProfileContent.findOne({ userId })
    .select(
      'aboutMe partnerDescription personal.maritalStatus personal.motherTongue ' +
        'education.degree education.field profession.jobTitle profession.occupation ' +
        'profession.industry lifestyle.diet lifestyle.interests lifestyle.hobbies ' +
        'location.city location.state family.familyValues family.familyType communityZone',
    )
    .lean()) as EmbeddingContentDoc | null;

  if (!doc) return { skipped: 'no-content' };

  const text = buildEmbeddingText(doc);
  if (!text) return { skipped: 'empty-text' };

  const res = await callAiService<EmbeddingResponse>('/ai/embedding/profile', {
    profile_id: profileId,
    text,
  });
  const payload = res.data ?? res;
  const embedding = payload.embedding;
  if (!payload.available || !embedding || embedding.length !== EMBEDDING_DIMS) {
    return { skipped: 'unavailable' };
  }

  // Persist: Mongo (canonical) + Postgres pgvector (indexed for search).
  await ProfileContent.updateOne(
    { userId },
    { $set: { aiEmbedding: embedding, embeddingUpdatedAt: new Date() } },
  );
  await syncProfileEmbedding(profileId, embedding);
  return { generated: true };
}

export function registerEmbeddingWorker(): Worker<EmbeddingGenerationJob> {
  const worker = new Worker<EmbeddingGenerationJob>(
    QUEUE_NAME,
    async (job) => runEmbeddingGeneration(job.data.userId, job.data.profileId),
    { connection, concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[embeddingGenerationJob] job ${job?.id} failed:`, err);
  });

  return worker;
}
