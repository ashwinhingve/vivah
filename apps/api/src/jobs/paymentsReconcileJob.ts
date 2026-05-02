import { Worker } from 'bullmq';
import { connection, paymentsReconcileQueue } from '../infrastructure/redis/queues.js';
import { reconcileDay } from '../payments/reconciliation.js';
import { logger } from '../lib/logger.js';

export interface PaymentsReconcileJob {
  date?: string;
}

export function registerPaymentsReconcileWorker(): Worker {
  const worker = new Worker<PaymentsReconcileJob>(
    'payments-reconcile',
    async (job) => {
      const date = job.data.date ? new Date(job.data.date) : (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 1);
        return d;
      })();
      logger.info({ date: date.toISOString() }, '[paymentsReconcile] starting');
      const result = await reconcileDay(date);
      logger.info({ date: date.toISOString(), ...result }, '[paymentsReconcile] done');
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[paymentsReconcile] job failed');
  });

  return worker;
}

export async function schedulePaymentsReconcileJob(): Promise<void> {
  await paymentsReconcileQueue.add(
    'daily-reconcile',
    {},
    {
      repeat:       { pattern: '0 3 * * *' },
      attempts:     3,
      backoff:      { type: 'exponential', delay: 60000 },
      removeOnFail: { count: 50 },
    },
  );
}
