/**
 * Canonical notification vocabulary shared by api + web.
 *
 * The system has two type layers:
 *   - `NotificationType` — the fine-grained *job* type enqueued at each call
 *     site (~50 values). This is the source of truth for behaviour.
 *   - `NotificationCategory` — the coarse UX bucket the bell/panel groups and
 *     colour-codes by. Derived from the job type via `notificationCategory()`.
 *
 * The DB `notification_type` pg-enum is a *third*, coarser vocabulary owned by
 * the api layer (see apps/api/src/notifications/service.ts). The UI never keys
 * off it — it reads `category` (persisted into the row's `data` jsonb).
 */

/** Coarse UX bucket used for grouping, icons and colours in the bell/panel. */
export type NotificationCategory =
  | 'MATCH'
  | 'INTEREST'
  | 'MESSAGE'
  | 'VIDEO_CALL'
  | 'EVENT'
  | 'PROFILE'
  | 'PAYMENT'
  | 'BOOKING'
  | 'VENDOR'
  | 'SYSTEM';

/**
 * Every job-type string actually enqueued onto the `notifications` BullMQ queue
 * across the api (audited from every `notificationsQueue.add()` / `pushNotify()`
 * / `queueNotification()` call site, plus the `wedding_reminder_type` values
 * passed straight through by weddingReminderJob). Kept as a union for docs +
 * editor help; consumers accept `string` too since it flows through Redis.
 */
export type NotificationType =
  // messaging
  | 'NEW_CHAT_MESSAGE' | 'NEW_MESSAGE'
  // interest / match lifecycle
  | 'MATCH_REQUEST_RECEIVED' | 'MATCH_REQUEST_SUPER_LIKE' | 'NEW_MATCH'
  | 'MATCH_REQUEST_ACCEPTED' | 'MATCH_ACCEPTED'
  | 'MATCH_REQUEST_DECLINED' | 'MATCH_DECLINED'
  | 'MATCH_WITHDRAWN' | 'MATCH_REQUEST_EXPIRED'
  // video meetings
  | 'MEETING_INVITE' | 'MEETING_REMINDER' | 'MEETING_PROPOSED' | 'MEETING_CONFIRMED'
  // bookings
  | 'NEW_BOOKING_REQUEST' | 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED'
  // vendor lifecycle
  | 'VENDOR_SUBMITTED' | 'VENDOR_APPROVED' | 'VENDOR_REJECTED' | 'VENDOR_SUSPENDED' | 'VENDOR_REINSTATED'
  // money
  | 'PAYMENT_CAPTURED' | 'PAYMENT_RECEIVED' | 'PAYMENT_FAILED' | 'PAYMENT_LINK_RECEIVED'
  | 'ESCROW_RELEASED' | 'PROMO_APPLIED'
  | 'REFUND_REQUESTED' | 'REFUND_COMPLETED' | 'REFUND_PROCESSED'
  | 'PAYOUT_INITIATED' | 'PAYOUT_FAILED'
  | 'INVOICE_AVAILABLE' | 'WALLET_CREDITED' | 'WALLET_DEBITED'
  | 'SUBSCRIPTION_RENEWED' | 'SUBSCRIPTION_FAILED'
  // disputes
  | 'DISPUTE_RAISED' | 'DISPUTE_RAISED_VENDOR' | 'DISPUTE_NEEDS_REVIEW' | 'DISPUTE_RESOLVED'
  // weddings / events
  | 'COORDINATOR_ASSIGNED' | 'INCIDENT_RAISED' | 'CEREMONY_REMINDER' | 'DAY_OF_CHECKIN'
  | 'BUDGET_ALERT' | 'RSVP_RECEIVED' | 'RSVP_FOLLOWUP' | 'TASK_DUE'
  | 'VENDOR_PAYMENT' | 'GUEST_REMINDER' | 'COUNTDOWN'
  | 'CEREMONY_T_30D' | 'CEREMONY_T_7D' | 'CEREMONY_T_1D' | 'CEREMONY_T_1H'
  // profile / moderation
  | 'PROFILE_REPORTED_MODERATION'
  // retention / churn recovery (Phase 7 Sprint F)
  | 'CHURN_WINBACK_OFFER' | 'CHURN_RECOVERY_NUDGE' | 'REENGAGE_NUDGE'
  // auto-marketing (Phase 6 Sprint J, Unit 6.4) — copy comes from the
  // campaign_content row, carried in the payload, not from a static template
  | 'MARKETING_CAMPAIGN'
  // catch-alls
  | 'SYSTEM' | 'GENERIC';

/** In-app notification row as surfaced to the web client. */
export interface NotificationRow {
  id:        string;
  userId:    string;
  /** DB pg-enum value — coarse; the UI keys off `category` in `data` instead. */
  type:      string;
  title:     string;
  body:      string;
  /**
   * Arbitrary payload. New rows carry `category`, `jobType` and `ctaUrl` written
   * at insert time; read them via the helpers in the web app rather than typing
   * the bag here (an index-signature `unknown` can't narrow to those unions).
   */
  data:      Record<string, unknown> | null;
  read:      boolean;
  sentVia:   string[] | null;
  createdAt: string;
}

/** Colour tone tokens — mapped to literal Tailwind classes in the UI (JIT-safe). */
export type NotificationTone = 'primary' | 'teal' | 'gold' | 'success' | 'destructive';

export interface NotificationCategoryMeta {
  /** lucide-react icon component name. */
  icon:  string;
  tone:  NotificationTone;
  label: string;
}

/** Display metadata per category — icon (lucide name), colour tone, label. */
export const notificationMeta: Record<NotificationCategory, NotificationCategoryMeta> = {
  MATCH:      { icon: 'Heart',         tone: 'primary',     label: 'Match' },
  INTEREST:   { icon: 'Sparkles',      tone: 'teal',        label: 'Interest' },
  MESSAGE:    { icon: 'MessageCircle', tone: 'teal',        label: 'Message' },
  VIDEO_CALL: { icon: 'Video',         tone: 'primary',     label: 'Video call' },
  EVENT:      { icon: 'CalendarClock', tone: 'gold',        label: 'Event' },
  PROFILE:    { icon: 'ShieldAlert',   tone: 'gold',        label: 'Profile' },
  PAYMENT:    { icon: 'Wallet',        tone: 'success',     label: 'Payment' },
  BOOKING:    { icon: 'CalendarCheck', tone: 'teal',        label: 'Booking' },
  VENDOR:     { icon: 'Store',         tone: 'primary',     label: 'Vendor' },
  SYSTEM:     { icon: 'Bell',          tone: 'gold',        label: 'Update' },
};

/**
 * Map a fine-grained job type → coarse UX category. Total and pure — any
 * unknown string resolves to 'SYSTEM'; never throws.
 */
export function notificationCategory(jobType: string): NotificationCategory {
  switch (jobType) {
    case 'NEW_CHAT_MESSAGE':
    case 'NEW_MESSAGE':
      return 'MESSAGE';

    case 'MATCH_REQUEST_RECEIVED':
    case 'MATCH_REQUEST_SUPER_LIKE':
    case 'NEW_MATCH':
      return 'INTEREST';

    case 'MATCH_REQUEST_ACCEPTED':
    case 'MATCH_ACCEPTED':
    case 'MATCH_REQUEST_DECLINED':
    case 'MATCH_DECLINED':
    case 'MATCH_WITHDRAWN':
    case 'MATCH_REQUEST_EXPIRED':
      return 'MATCH';

    case 'MEETING_INVITE':
    case 'MEETING_REMINDER':
    case 'MEETING_PROPOSED':
    case 'MEETING_CONFIRMED':
      return 'VIDEO_CALL';

    case 'NEW_BOOKING_REQUEST':
    case 'BOOKING_CONFIRMED':
    case 'BOOKING_CANCELLED':
      return 'BOOKING';

    case 'VENDOR_SUBMITTED':
    case 'VENDOR_APPROVED':
    case 'VENDOR_REJECTED':
    case 'VENDOR_SUSPENDED':
    case 'VENDOR_REINSTATED':
      return 'VENDOR';

    case 'PAYMENT_CAPTURED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_FAILED':
    case 'PAYMENT_LINK_RECEIVED':
    case 'ESCROW_RELEASED':
    case 'PROMO_APPLIED':
    case 'REFUND_REQUESTED':
    case 'REFUND_COMPLETED':
    case 'REFUND_PROCESSED':
    case 'PAYOUT_INITIATED':
    case 'PAYOUT_FAILED':
    case 'INVOICE_AVAILABLE':
    case 'WALLET_CREDITED':
    case 'WALLET_DEBITED':
    case 'SUBSCRIPTION_RENEWED':
    case 'SUBSCRIPTION_FAILED':
    case 'DISPUTE_RAISED':
    case 'DISPUTE_RAISED_VENDOR':
    case 'DISPUTE_NEEDS_REVIEW':
    case 'DISPUTE_RESOLVED':
      return 'PAYMENT';

    case 'COORDINATOR_ASSIGNED':
    case 'INCIDENT_RAISED':
    case 'CEREMONY_REMINDER':
    case 'DAY_OF_CHECKIN':
    case 'BUDGET_ALERT':
    case 'RSVP_RECEIVED':
    case 'RSVP_FOLLOWUP':
    case 'TASK_DUE':
    case 'VENDOR_PAYMENT':
    case 'GUEST_REMINDER':
    case 'COUNTDOWN':
    case 'CEREMONY_T_30D':
    case 'CEREMONY_T_7D':
    case 'CEREMONY_T_1D':
    case 'CEREMONY_T_1H':
      return 'EVENT';

    case 'PROFILE_REPORTED_MODERATION':
      return 'PROFILE';

    default:
      return 'SYSTEM';
  }
}

function str(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Resolve the in-app deep-link target for a notification. Prefers any explicit
 * URL the caller stashed in the payload, otherwise derives a sensible route
 * from the job type + payload ids. Returns undefined when nothing is linkable.
 *
 * Routes are locale-agnostic (the web `Link` prepends the locale).
 */
export function deepLinkFor(jobType: string, payload: Record<string, unknown>): string | undefined {
  const explicit = str(payload, 'ctaUrl') ?? str(payload, 'matchUrl')
    ?? str(payload, 'receiptUrl') ?? str(payload, 'joinUrl');
  if (explicit) return explicit;

  // Retention nudges point the user back at their matches/requests.
  if (jobType === 'CHURN_WINBACK_OFFER' || jobType === 'CHURN_RECOVERY_NUDGE'
      || jobType === 'REENGAGE_NUDGE') {
    return '/matches';
  }

  const bookingId = str(payload, 'bookingId');
  const weddingId = str(payload, 'weddingId');
  const matchId   = str(payload, 'matchRequestId') ?? str(payload, 'matchId');

  switch (notificationCategory(jobType)) {
    case 'MESSAGE':
      return matchId ? `/chat/${matchId}` : '/chats';
    case 'INTEREST':
      return jobType === 'NEW_MATCH' ? '/matches' : '/requests';
    case 'MATCH':
      return '/matches';
    case 'VIDEO_CALL':
      return matchId ? `/chat/${matchId}` : '/chats';
    case 'BOOKING':
      return bookingId ? `/bookings/${bookingId}` : '/bookings';
    case 'VENDOR':
      return '/vendor-dashboard';
    case 'EVENT':
      return weddingId ? `/weddings/${weddingId}` : '/weddings';
    case 'PROFILE':
      return '/admin';
    case 'PAYMENT':
      if (jobType.startsWith('REFUND')) return '/payments/refunds';
      if (jobType.startsWith('PAYOUT')) return '/vendor/payouts';
      if (jobType === 'INVOICE_AVAILABLE') return '/payments/invoices';
      if (jobType.startsWith('WALLET')) return '/payments/wallet';
      if (jobType.startsWith('DISPUTE')) {
        return bookingId ? `/bookings/${bookingId}/dispute` : '/bookings';
      }
      return '/payments';
    default:
      return undefined;
  }
}
