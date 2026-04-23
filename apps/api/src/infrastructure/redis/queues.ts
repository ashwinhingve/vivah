import { Queue } from 'bullmq';
import { env } from '../../lib/env.js';

/** Payload for a single guna recalculation job. */
export interface MatchComputeJob {
  profileAId: string; // alphabetically first ID
  profileBId: string; // alphabetically second ID
}

/**
 * BullMQ requires its own dedicated ioredis connection — it cannot share the
 * singleton in lib/redis.ts. enableOfflineQueue: false fails fast when Redis
 * is unreachable (tests / dev without infra). maxRetriesPerRequest: null is
 * required by BullMQ ^5.
 */
export const connection = {
  url: env.REDIS_URL,
  enableOfflineQueue: false,
  maxRetriesPerRequest: null as unknown as number,
};

/** Default retry options for enqueued jobs. */
export const DEFAULT_JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnFail: { count: 100 },
  removeOnComplete: { count: 1000 },
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

/** Payload for a delayed escrow release job. */
export interface EscrowReleaseJob {
  escrowId:  string | null;
  bookingId: string;
  vendorId:  string;
  amount:    number;
}

export const escrowReleaseQueue = new Queue<EscrowReleaseJob>(
  'escrow-release',
  { connection },
);

/** Payload for a delayed order expiry job — cancels PLACED orders unpaid after TTL. */
export interface OrderExpiryJob {
  orderId: string;
}

export const orderExpiryQueue = new Queue<OrderExpiryJob>(
  'order-expiry',
  { connection },
);
