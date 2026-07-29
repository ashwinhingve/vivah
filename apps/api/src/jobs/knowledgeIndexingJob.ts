/**
 * Smart Shaadi — Knowledge-base indexing job (assistant RAG)
 *
 * Two triggers:
 *   - 'full-reindex': nightly repeatable (21:30 UTC = 03:00 IST) + manual
 *     backfill via bin/reindex-knowledge.ts. Content-hash diffing in the
 *     indexer makes a no-change night embedding-free.
 *   - 'vendor': event-driven, enqueued from vendor create/update/delete paths
 *     so public listings stay searchable by the assistant without waiting for
 *     the nightly sweep.
 *
 * Concurrency 1 — a full reindex already batches embedding calls; parallel
 * runs would only contend on the ai-service embedding model.
 */
import { Worker } from 'bullmq';
import {
  connection,
  knowledgeIndexingQueue,
  type KnowledgeIndexingJob,
} from '../infrastructure/redis/queues.js';
import { logger } from '../lib/logger.js';
import { fullReindexKnowledge, indexVendor } from '../services/knowledgeIndexer.js';

const QUEUE_NAME = 'knowledge-indexing';

export function registerKnowledgeIndexingWorker(): Worker<KnowledgeIndexingJob> {
  const worker = new Worker<KnowledgeIndexingJob>(
    QUEUE_NAME,
    async (job) => {
      if (job.data.type === 'vendor') {
        const result = await indexVendor(job.data.sourceId);
        logger.info({ vendorId: job.data.sourceId, ...result }, '[knowledgeIndexing] vendor done');
        return result;
      }
      logger.info('[knowledgeIndexing] full reindex starting');
      const result = await fullReindexKnowledge();
      logger.info(result, '[knowledgeIndexing] full reindex done');
      return result;
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[knowledgeIndexing] job failed');
  });

  return worker;
}

export async function scheduleKnowledgeIndexingJob(): Promise<void> {
  await knowledgeIndexingQueue.add(
    'nightly-reindex',
    { type: 'full-reindex' },
    {
      repeat:       { pattern: '30 21 * * *' }, // 21:30 UTC = 03:00 IST, quiet hours
      attempts:     3,
      backoff:      { type: 'exponential', delay: 60000 },
      removeOnFail: { count: 50 },
    },
  );
}
