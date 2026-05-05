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
  // Railway private hostnames are AAAA-only — see lib/redis.ts comment.
  family: 0,
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
  userId:    string;
  /** Optional profiles.id — worker resolves to user.id when set. */
  profileId?: string;
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

/** Payload for the match request expiry sweeper — repeatable, no per-request payload. */
export interface MatchRequestExpiryJob {
  scheduledAt: string;
}

export const matchRequestExpiryQueue = new Queue<MatchRequestExpiryJob>(
  'match-request-expiry',
  { connection },
);

/** RSVP reminder — scheduled reminder N days before deadline. */
export interface RsvpReminderJob {
  weddingId:  string;
  daysBefore: number;
}

export const rsvpReminderQueue = new Queue<RsvpReminderJob>(
  'rsvp-reminder',
  { connection },
);

/** Save-the-date one-shot. */
export interface SaveTheDateJob {
  weddingId: string;
  guestId:   string;
  channel:   string;
}

export const saveTheDateQueue = new Queue<SaveTheDateJob>(
  'save-the-date',
  { connection },
);

/** Thank-you delayed 24h post-RSVP YES. */
export interface ThankYouJob {
  weddingId: string;
  guestId:   string;
}

export const thankYouQueue = new Queue<ThankYouJob>(
  'thank-you',
  { connection },
);

/** Token cleanup — repeatable cron, no per-run payload. */
export interface TokenCleanupJob {
  scheduledAt: string;
}

export const tokenCleanupQueue = new Queue<TokenCleanupJob>(
  'token-cleanup',
  { connection },
);

/** Daily payments reconciliation. */
export interface PaymentsReconcileJob {
  date?: string;
}

export const paymentsReconcileQueue = new Queue<PaymentsReconcileJob>(
  'payments-reconcile',
  { connection },
);

/** Wedding reminder dispatcher — scans wedding_reminders for due rows. */
export interface WeddingReminderJob {
  scheduledAt: string;
}

export const weddingReminderQueue = new Queue<WeddingReminderJob>(
  'wedding-reminder',
  { connection },
);

/** Invitation blast — periodic worker pulling pending invitations. */
export interface InvitationBlastJob {
  scheduledAt: string;
}

export const invitationBlastQueue = new Queue<InvitationBlastJob>(
  'invitation-blast',
  { connection },
);
