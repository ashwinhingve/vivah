/**
 * One-off knowledge-base backfill / reindex.
 *
 *   pnpm --filter @smartshaadi/api reindex-knowledge
 *
 * Runs the same fullReindexKnowledge() the nightly Bull job uses, directly in
 * this process (no Redis needed). Requires Postgres (0042 applied) and a
 * running ai-service with the embedding model. Content-hash diffing makes
 * re-runs cheap and safe.
 */
import { fullReindexKnowledge } from '../services/knowledgeIndexer.js';

async function main(): Promise<void> {
  console.info('[reindex-knowledge] starting full knowledge-base reindex…');
  const started = Date.now();
  const result = await fullReindexKnowledge();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.info(
    `[reindex-knowledge] done in ${seconds}s — ` +
    `embedded=${result.embedded} unchanged=${result.unchanged} ` +
    `deleted=${result.deleted} errors=${result.errors}`,
  );
  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[reindex-knowledge] fatal:', err);
  process.exit(1);
});
