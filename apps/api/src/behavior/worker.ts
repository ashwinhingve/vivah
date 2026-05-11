import { Worker } from 'bullmq';
import { connection, type BehaviorEventJob } from '../infrastructure/redis/queues.js';
import { persistBehaviorEvent } from './service.js';
import { logger } from '../lib/logger.js';

export function registerBehaviorEventWorker(): Worker<BehaviorEventJob> {
  const worker = new Worker<BehaviorEventJob>(
    'behavior-event',
    async (job) => {
      await persistBehaviorEvent(job.data);
    },
    { connection, concurrency: 8 },
  );

  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err }, '[behaviorEvent] job failed');
  });

  return worker;
}
