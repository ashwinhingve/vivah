/**
 * Data export worker — drives GDPR Article 15 archive generation.
 *
 * Each enqueued job carries { requestId }. The worker calls
 * dataExportService.processExportRequest which updates status, aggregates
 * user data, uploads to R2, and notifies the user by email.
 *
 * Concurrency is capped at 2 — the aggregation step pulls Postgres + Mongo
 * and writes a multi-MB JSON to R2, so running too many in parallel can
 * starve the API.
 */
import { Worker, Queue, type Job } from 'bullmq';
import { connection, DEFAULT_JOB_OPTS } from '../infrastructure/redis/queues.js';
import { processExportRequest } from '../services/dataExportService.js';

const QUEUE_NAME = 'data-export';
const CONCURRENCY = 2;

export interface DataExportJob {
  requestId: string;
  userId:    string;
}

let worker: Worker<DataExportJob> | null = null;
let queue:  Queue<DataExportJob>  | null = null;

function getQueue(): Queue<DataExportJob> {
  if (!queue) queue = new Queue<DataExportJob>(QUEUE_NAME, { connection });
  return queue;
}

export function startDataExportWorker(): { close(): Promise<void> } {
  if (worker) return { close: () => stopDataExportWorker() };
  getQueue();
  worker = new Worker<DataExportJob>(
    QUEUE_NAME,
    async (job: Job<DataExportJob>) => {
      await processExportRequest(job.data.requestId);
    },
    { connection, concurrency: CONCURRENCY },
  );
  worker.on('failed', (job, err) => {
    console.warn(`[data-export] job ${job?.id} failed:`, err.message);
  });
  return { close: () => stopDataExportWorker() };
}

export async function stopDataExportWorker(): Promise<void> {
  try {
    if (worker) await worker.close();
    if (queue)  await queue.close();
  } finally {
    worker = null;
    queue  = null;
  }
}

export async function scheduleDataExportJob(payload: DataExportJob): Promise<void> {
  const q = getQueue();
  await q.add('export', payload, DEFAULT_JOB_OPTS);
}
