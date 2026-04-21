import { Queue } from 'bullmq';
import { env } from '../../lib/env.js';

/** Payload for a single guna recalculation job. */
export interface MatchComputeJob {
  profileAId: string; // alphabetically first ID
  profileBId: string; // alphabetically second ID
}

/**
 * BullMQ requires its own dedicated ioredis connection —
 * it cannot share the singleton in lib/redis.ts.
 */
/**
 * enableOfflineQueue: false — fail fast when Redis is unreachable (e.g. in tests)
 * maxRetriesPerRequest: null — required by BullMQ ^5 (prevents deprecation warning)
 */
const connection = {
  url: env.REDIS_URL,
  enableOfflineQueue: false,
  maxRetriesPerRequest: null as unknown as number,
};

export const matchComputeQueue = new Queue<MatchComputeJob>(
  'match-compute',
  { connection },
);

/** Payload for a notification delivery job (SMS / email / push). */
export interface NotificationJob {
  userId:  string;
  type:    string;
  payload: Record<string, unknown>;
}

export const notificationsQueue = new Queue<NotificationJob>(
  'notifications',
  { connection },
);

export async function queueNotification(job: NotificationJob): Promise<void> {
  await notificationsQueue.add(job.type, job);
}
