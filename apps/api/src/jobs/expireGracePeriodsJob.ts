import { Worker } from 'bullmq';
import {
  connection,
  expireGracePeriodsQueue,
  type ExpireGracePeriodsJob,
} from '../infrastructure/redis/queues.js';
import { expireGracePeriods } from '../payments/subscriptions.js';
import { logger } from '../lib/logger.js';

export function registerExpireGracePeriodsWorker(): Worker {
  const worker = new Worker<ExpireGracePeriodsJob>(
    'expire-grace-periods',
    async () => {
      logger.info('[expireGracePeriods] starting');
      const result = await expireGracePeriods();
      logger.info(result, '[expireGracePeriods] done');
    },
    { connection, lockDuration: 300_000 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[expireGracePeriods] job failed');
  });

  return worker;
}

export async function scheduleExpireGracePeriodsJob(): Promise<void> {
  await expireGracePeriodsQueue.add(
    'hourly-expire',
    {},
    {
      repeat:       { pattern: '0 * * * *' },
      attempts:     3,
      backoff:      { type: 'exponential', delay: 60_000 },
      removeOnFail: { count: 50 },
    },
  );
}
