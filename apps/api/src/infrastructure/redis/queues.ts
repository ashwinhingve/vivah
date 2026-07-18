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

/**
 * Enqueue a notification to fire after `delayMs` (BullMQ delayed job). Used for
 * scheduled reminders (e.g. a virtual-date reminder 15 min before start).
 * Best-effort — never throws to callers; a missed reminder must not fail the
 * request that scheduled it. A non-positive delay is dropped (already past).
 * An optional deterministic `jobId` de-dupes repeated schedules onto one job.
 */
export async function queueDelayedNotification(
  job: NotificationJob,
  delayMs: number,
  jobId?: string,
): Promise<void> {
  if (delayMs <= 0) return;
  try {
    await notificationsQueue.add(job.type, job, {
      delay: delayMs,
      removeOnComplete: true,
      ...(jobId ? { jobId } : {}),
    });
  } catch {
    // Redis unreachable (dev/test without infra) — a reminder is a non-critical
    // enhancement; skip silently rather than fail the scheduling request.
  }
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

/**
 * Delayed wedding-completion job — fires the day after the wedding date and
 * flips status PLANNING/CONFIRMED → COMPLETED. Enqueued with deterministic
 * jobId `wedding-complete-${weddingId}` so it can be replaced when the date
 * changes and never double-scheduled.
 */
export interface WeddingCompletionJob {
  weddingId:   string;
  weddingDate: string; // YYYY-MM-DD the job was scheduled for
}

export const weddingCompletionQueue = new Queue<WeddingCompletionJob>(
  'wedding-completion',
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExpireGracePeriodsJob {}

export const expireGracePeriodsQueue = new Queue<ExpireGracePeriodsJob>(
  'expire-grace-periods',
  { connection },
);

/** Payload for a single captured behavior event (request observation). */
export interface BehaviorEventJob {
  userId:      string;
  route:       string;
  method:      string;
  statusCode:  number;
  durationMs:  number;
  ts:          string;
  meta?:       Record<string, unknown>;
}

export const behaviorEventQueue = new Queue<BehaviorEventJob>(
  'behavior-event',
  { connection },
);

/**
 * Profile embedding generation — enqueued when a user's profile content changes
 * so the semantic "find similar matches" vector stays fresh. Never runs
 * synchronously in a request handler (Rule 8). Deterministic jobId
 * `embed-${profileId}` de-dupes rapid successive edits into one refresh.
 */
export interface EmbeddingGenerationJob {
  userId:    string;
  profileId: string;
}

export const embeddingGenerationQueue = new Queue<EmbeddingGenerationJob>(
  'embedding-generation',
  { connection },
);

/**
 * WhatsApp Business template send (Unit 6.1, Tier 2). Enqueued from the booking
 * flow / admin trigger — NEVER sent synchronously in a request handler (Rule 8).
 * Deterministic jobId `wa-${messageId}` de-dupes retries onto one row.
 */
export interface WhatsAppSendJob {
  messageId: string;
}

export const whatsappQueue = new Queue<WhatsAppSendJob>(
  'whatsapp-send',
  { connection },
);

/** Enqueue a profile embedding refresh (best-effort — never throws to callers). */
export async function queueEmbeddingGeneration(job: EmbeddingGenerationJob): Promise<void> {
  try {
    await embeddingGenerationQueue.add('generate', job, {
      jobId: `embed-${job.profileId}`,
      ...DEFAULT_JOB_OPTS,
    });
  } catch {
    // Redis unreachable (dev/test without infra) — embedding refresh is a
    // non-critical enhancement; skip silently.
  }
}
