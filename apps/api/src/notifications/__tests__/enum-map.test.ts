import { describe, it, expect } from 'vitest';
import { toNotificationEnum, isValidNotificationEnum, DB_ENUM_VALUES } from '../enum-map.js';

/**
 * Every job-type string actually enqueued onto the `notifications` queue across
 * the api (audited from every notificationsQueue.add / pushNotify / notifyAdmins
 * / queueNotification call site, plus the wedding_reminder_type values passed
 * through by weddingReminderJob). If a new call site introduces a type, add it
 * here — this test is the guard against the old silent-drop regression where an
 * unmapped type resolved to the invalid 'INFO' enum value and threw on insert.
 */
const ALL_JOB_TYPES = [
  // messaging
  'NEW_CHAT_MESSAGE', 'NEW_MESSAGE',
  // interest / match
  'MATCH_REQUEST_RECEIVED', 'MATCH_REQUEST_SUPER_LIKE', 'NEW_MATCH',
  'MATCH_REQUEST_ACCEPTED', 'MATCH_ACCEPTED', 'MATCH_REQUEST_DECLINED',
  'MATCH_DECLINED', 'MATCH_WITHDRAWN', 'MATCH_REQUEST_EXPIRED',
  // video
  'MEETING_INVITE', 'MEETING_REMINDER', 'MEETING_PROPOSED', 'MEETING_CONFIRMED',
  // bookings
  'NEW_BOOKING_REQUEST', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED',
  // vendor lifecycle
  'VENDOR_SUBMITTED', 'VENDOR_APPROVED', 'VENDOR_REJECTED', 'VENDOR_SUSPENDED', 'VENDOR_REINSTATED',
  // money
  'PAYMENT_CAPTURED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'PAYMENT_LINK_RECEIVED',
  'ESCROW_RELEASED', 'PROMO_APPLIED', 'REFUND_REQUESTED', 'REFUND_COMPLETED',
  'REFUND_PROCESSED', 'PAYOUT_INITIATED', 'PAYOUT_FAILED', 'INVOICE_AVAILABLE',
  'WALLET_CREDITED', 'WALLET_DEBITED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_FAILED',
  // disputes
  'DISPUTE_RAISED', 'DISPUTE_RAISED_VENDOR', 'DISPUTE_NEEDS_REVIEW', 'DISPUTE_RESOLVED',
  // weddings / events
  'COORDINATOR_ASSIGNED', 'INCIDENT_RAISED', 'CEREMONY_REMINDER', 'DAY_OF_CHECKIN',
  'BUDGET_ALERT', 'RSVP_RECEIVED', 'RSVP_FOLLOWUP', 'TASK_DUE', 'VENDOR_PAYMENT',
  'GUEST_REMINDER', 'COUNTDOWN', 'CEREMONY_T_30D', 'CEREMONY_T_7D', 'CEREMONY_T_1D', 'CEREMONY_T_1H',
  // profile / moderation
  'PROFILE_REPORTED_MODERATION',
  // catch-alls
  'SYSTEM', 'GENERIC',
];

describe('toNotificationEnum', () => {
  it('resolves EVERY real job type to a valid notification_type enum value', () => {
    for (const jobType of ALL_JOB_TYPES) {
      const resolved = toNotificationEnum(jobType);
      expect(
        isValidNotificationEnum(resolved),
        `${jobType} → ${resolved} is not a valid notification_type enum value`,
      ).toBe(true);
    }
  });

  it('never returns the old invalid INFO fallback', () => {
    for (const jobType of [...ALL_JOB_TYPES, 'TOTALLY_UNKNOWN_TYPE']) {
      expect(toNotificationEnum(jobType)).not.toBe('INFO');
    }
  });

  it('falls back to SYSTEM for unknown types', () => {
    expect(toNotificationEnum('TOTALLY_UNKNOWN_TYPE')).toBe('SYSTEM');
  });

  it('applies the documented cross-vocabulary mappings', () => {
    expect(toNotificationEnum('NEW_CHAT_MESSAGE')).toBe('NEW_MESSAGE');
    expect(toNotificationEnum('MATCH_REQUEST_RECEIVED')).toBe('NEW_MATCH');
    expect(toNotificationEnum('PAYMENT_CAPTURED')).toBe('PAYMENT_RECEIVED');
    expect(toNotificationEnum('REFUND_COMPLETED')).toBe('REFUND_PROCESSED');
    expect(toNotificationEnum('CEREMONY_T_7D')).toBe('CEREMONY_REMINDER');
  });

  it('passes through types that are already valid enum values', () => {
    expect(toNotificationEnum('BOOKING_CONFIRMED')).toBe('BOOKING_CONFIRMED');
    expect(toNotificationEnum('COORDINATOR_ASSIGNED')).toBe('COORDINATOR_ASSIGNED');
    expect(DB_ENUM_VALUES.has('SYSTEM')).toBe(true);
  });
});
