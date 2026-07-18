/**
 * Job-type → DB `notification_type` pg-enum resolution.
 *
 * Kept in its own dependency-free module so it can be unit-tested without
 * dragging in the db/BullMQ/socket import chain that `service.ts` pulls.
 */

/** Every value of the DB `notification_type` pg-enum (packages/db/schema/index.ts:267). */
export const DB_ENUM_VALUES = new Set<string>([
  'NEW_MATCH', 'MATCH_ACCEPTED', 'MATCH_DECLINED', 'NEW_MESSAGE',
  'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED',
  'ESCROW_RELEASED', 'RSVP_RECEIVED', 'TASK_DUE', 'SYSTEM',
  'REFUND_REQUESTED', 'REFUND_PROCESSED', 'PAYOUT_INITIATED', 'PAYOUT_FAILED',
  'INVOICE_AVAILABLE', 'WALLET_CREDITED', 'WALLET_DEBITED', 'PAYMENT_LINK_RECEIVED',
  'PROMO_APPLIED', 'NEW_BOOKING_REQUEST', 'DISPUTE_RAISED_VENDOR',
  'DISPUTE_NEEDS_REVIEW', 'DISPUTE_RESOLVED', 'BUDGET_ALERT', 'CEREMONY_REMINDER',
  'DAY_OF_CHECKIN', 'INCIDENT_RAISED', 'COORDINATOR_ASSIGNED',
]);

/**
 * Cross-vocabulary mappings: job types whose name differs from the DB enum
 * value they should persist as. Anything not listed that is ALREADY a valid
 * enum value passes through unchanged; everything else falls back to 'SYSTEM'.
 */
const SEMANTIC_ENUM_MAP: Record<string, string> = {
  NEW_CHAT_MESSAGE:            'NEW_MESSAGE',
  MATCH_REQUEST_RECEIVED:      'NEW_MATCH',
  MATCH_REQUEST_SUPER_LIKE:    'NEW_MATCH',
  MATCH_REQUEST_ACCEPTED:      'MATCH_ACCEPTED',
  MATCH_REQUEST_DECLINED:      'MATCH_DECLINED',
  MATCH_WITHDRAWN:             'MATCH_DECLINED',
  MATCH_REQUEST_EXPIRED:       'SYSTEM',
  PAYMENT_CAPTURED:            'PAYMENT_RECEIVED',
  REFUND_COMPLETED:            'REFUND_PROCESSED',
  SUBSCRIPTION_RENEWED:        'PAYMENT_RECEIVED',
  SUBSCRIPTION_FAILED:         'PAYMENT_FAILED',
  MEETING_INVITE:              'SYSTEM',
  MEETING_REMINDER:            'SYSTEM',
  MEETING_PROPOSED:            'SYSTEM',
  MEETING_CONFIRMED:           'SYSTEM',
  DISPUTE_RAISED:              'DISPUTE_RAISED_VENDOR',
  VENDOR_SUBMITTED:            'SYSTEM',
  VENDOR_APPROVED:             'SYSTEM',
  VENDOR_REJECTED:             'SYSTEM',
  VENDOR_SUSPENDED:            'SYSTEM',
  VENDOR_REINSTATED:           'SYSTEM',
  PROFILE_REPORTED_MODERATION: 'SYSTEM',
  CHURN_WINBACK_OFFER:         'SYSTEM',
  CHURN_RECOVERY_NUDGE:        'SYSTEM',
  REENGAGE_NUDGE:              'SYSTEM',
  RSVP_FOLLOWUP:               'RSVP_RECEIVED',
  VENDOR_PAYMENT:              'SYSTEM',
  GUEST_REMINDER:              'SYSTEM',
  COUNTDOWN:                   'CEREMONY_REMINDER',
  CEREMONY_T_30D:              'CEREMONY_REMINDER',
  CEREMONY_T_7D:               'CEREMONY_REMINDER',
  CEREMONY_T_1D:               'CEREMONY_REMINDER',
  CEREMONY_T_1H:               'CEREMONY_REMINDER',
  GENERIC:                     'SYSTEM',
};

/**
 * Resolve a job type to a valid `notification_type` pg-enum value. Total —
 * always returns a value present in DB_ENUM_VALUES (never the old invalid
 * 'INFO' fallback that silently dropped most in-app rows).
 */
export function toNotificationEnum(type: string): string {
  const mapped = SEMANTIC_ENUM_MAP[type];
  if (mapped) return mapped;
  if (DB_ENUM_VALUES.has(type)) return type;
  return 'SYSTEM';
}

export function isValidNotificationEnum(value: string): boolean {
  return DB_ENUM_VALUES.has(value);
}
