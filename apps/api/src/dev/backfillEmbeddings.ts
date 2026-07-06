/**
 * Backfill profile embeddings for all active profiles.
 *
 * For each active profile: assemble text → embed via ai-service → persist to
 * Mongo (ProfileContent.aiEmbedding) + pgvector (profiles.ai_embedding). Uses
 * the same runEmbeddingGeneration core the live Bull worker uses, so behavior is
 * identical to on-edit refreshes.
 *
 * Run once after applying migration 0030 and deploying the ai-service embedding
 * endpoint (requires the ai-service reachable at AI_SERVICE_URL and NOT in mock
 * mode):
 *   pnpm tsx apps/api/src/dev/backfillEmbeddings.ts
 *
 * Idempotent: safe to re-run; each profile is simply re-embedded.
 */
import { eq } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { connectMongo } from '../lib/mongo.js';
import { env } from '../lib/env.js';
import { runEmbeddingGeneration } from '../jobs/embeddingGenerationJob.js';

async function main(): Promise<void> {
  if (env.USE_MOCK_SERVICES) {
    console.error('Refusing to run in mock mode — set USE_MOCK_SERVICES=false with a live DB.');
    process.exit(1);
  }

  await connectMongo();

  const rows = await db
    .select({ id: profiles.id, userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.isActive, true));

  console.info(`[backfillEmbeddings] ${rows.length} active profiles`);

  let generated = 0;
  const skipped: Record<string, number> = {};
  for (const row of rows) {
    try {
      const res = await runEmbeddingGeneration(row.userId, row.id);
      if (res.generated) {
        generated++;
      } else {
        const key = res.skipped ?? 'unknown';
        skipped[key] = (skipped[key] ?? 0) + 1;
      }
    } catch (e) {
      skipped['error'] = (skipped['error'] ?? 0) + 1;
      console.error(`[backfillEmbeddings] ${row.id} failed:`, e instanceof Error ? e.message : e);
    }
    if ((generated + Object.values(skipped).reduce((a, b) => a + b, 0)) % 50 === 0) {
      console.info(`[backfillEmbeddings] progress — generated=${generated}`);
    }
  }

  console.info(`[backfillEmbeddings] done — generated=${generated}, skipped=${JSON.stringify(skipped)}`);
  process.exit(0);
}

void main();
