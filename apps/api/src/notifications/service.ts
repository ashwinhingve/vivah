/**
 * Notifications service — channel router.
 *
 * Single entry point: deliverNotification(job).
 * Looks up user prefs + device tokens, fans out to push/email/sms providers,
 * persists in `notifications` table for in-app surface.
 */

import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  user,
  notifications,
  notificationPreferences,
  deviceTokens,
} from '@smartshaadi/db';
import { notificationsQueue } from '../infrastructure/redis/queues.js';
import { sendPush } from './providers/fcm.js';
import { sendEmail } from './providers/ses.js';
import { sendSms } from './providers/msg91.js';
import * as emailTpl from './templates/email.js';
import * as smsTpl from './templates/sms.js';
import { emitNotification } from './realtime.js';
import { notificationCategory, deepLinkFor, type NotificationType } from '@smartshaadi/types';
import { toNotificationEnum } from './enum-map.js';

type SentVia = 'push' | 'email' | 'sms' | 'inapp';

// NotificationType is the canonical job-type union — now owned by
// @smartshaadi/types and re-exported here for existing importers.
export type { NotificationType };

export interface NotificationDeliveryJob {
  /** Recipient user.id (Better Auth). Either `userId` OR `profileId` is required. */
  userId:    string;
  /**
   * Optional `profiles.id` — when present, the worker resolves it to user.id
   * before delivery. Matchmaking callsites only have profile IDs available, so
   * they pass `profileId` here; the resolution layer joins `profiles.userId`.
   */
  profileId?: string;
  type:    NotificationType | string;
  payload: Record<string, unknown>;
}

import { profiles } from '@smartshaadi/db';

async function resolveRecipientUserId(job: NotificationDeliveryJob): Promise<string | null> {
  // When profileId is supplied, resolve it to user.id regardless of whether
  // userId matches — matchmaking callers historically passed both fields
  // equal to the same profile UUID; newer callers may pass distinct values.
  if (job.profileId) {
    const [row] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, job.profileId))
      .limit(1);
    if (row?.userId) return row.userId;
    return null;
  }
  return job.userId;
}

/**
 * Fan-out helper for moderator/admin notifications. Queries the `user` table
 * for every ADMIN-role account and enqueues one delivery job per admin.
 * Use this for DISPUTE_NEEDS_REVIEW, PROFILE_REPORTED_MODERATION, and any
 * other event that should reach the admin queue rather than a single user.
 */
export async function notifyAdmins(
  type: NotificationType | string,
  payload: Record<string, unknown>,
): Promise<{ enqueued: number }> {
  const admins = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, 'ADMIN'));

  if (admins.length === 0) {
    console.warn('[notifications] notifyAdmins: no ADMIN users in database', { type });
    return { enqueued: 0 };
  }

  await Promise.all(
    admins.map((a) =>
      notificationsQueue
        .add(type, { type, userId: a.id, payload })
        .catch((e) => console.warn('[notifications] notifyAdmins enqueue failed:', a.id, e)),
    ),
  );
  return { enqueued: admins.length };
}

interface UserPrefs {
  push:       boolean;
  sms:        boolean;
  email:      boolean;
  inApp:      boolean;
  marketing:  boolean;
  mutedTypes: string[];
}

async function getUserPrefs(userId: string): Promise<UserPrefs> {
  const [row] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  if (!row) return { push: true, sms: true, email: true, inApp: true, marketing: false, mutedTypes: [] };
  return {
    push:       row.push,
    sms:        row.sms,
    email:      row.email,
    inApp:      row.inApp,
    marketing:  row.marketing,
    mutedTypes: (row.mutedTypes as string[] | null) ?? [],
  };
}

async function getUserContact(userId: string): Promise<{ name: string; email: string | null; phone: string | null }> {
  const [u] = await db.select({
    name:        user.name,
    email:       user.email,
    phoneNumber: user.phoneNumber,
  }).from(user).where(eq(user.id, userId));
  return {
    name:  u?.name ?? '',
    email: u?.email ?? null,
    phone: u?.phoneNumber ?? null,
  };
}

async function getDeviceTokens(userId: string): Promise<Array<{ token: string; platform: string }>> {
  return db.select({ token: deviceTokens.token, platform: deviceTokens.platform })
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId));
}

interface RenderedContent {
  title:    string;
  body:     string;
  email:   { subject: string; html: string; text: string };
  sms:      string;
  ctaUrl?:  string;
}

/** "MATCH_REQUEST_EXPIRED" → "Match request expired" — readable last resort. */
function humanize(type: string): string {
  const t = type.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** CTA button label keyed off the coarse category. */
function ctaLabelFor(type: string): string {
  switch (notificationCategory(type)) {
    case 'MESSAGE':    return 'Open chat';
    case 'VIDEO_CALL': return 'View call';
    case 'BOOKING':    return 'View booking';
    case 'PAYMENT':    return 'View details';
    case 'VENDOR':     return 'Open dashboard';
    case 'PROFILE':    return 'Review';
    default:           return 'View';
  }
}

/**
 * Human title/body for every job type not covered by a bespoke render() case.
 * Reads real payload fields so email/SMS/in-app bodies are never empty. Any
 * unknown type falls back to a humanized title (never blank).
 */
function describe(type: string, payload: Record<string, unknown>): { title: string; body: string } {
  const s = (k: string): string => (typeof payload[k] === 'string' ? (payload[k] as string) : '');
  const rupees = `₹${Number(payload['amount'] ?? 0).toLocaleString('en-IN')}`;

  switch (type) {
    case 'MATCH_REQUEST_RECEIVED':   return { title: 'New interest received',    body: 'Someone is interested in your profile.' };
    case 'MATCH_REQUEST_SUPER_LIKE': return { title: 'Super interest received ✨', body: 'Someone super-liked your profile.' };
    case 'MATCH_ACCEPTED':
    case 'MATCH_REQUEST_ACCEPTED':   return { title: "You're connected 🎉",       body: 'Your interest was accepted — start a conversation.' };
    case 'MATCH_DECLINED':
    case 'MATCH_REQUEST_DECLINED':   return { title: 'Interest declined',         body: 'Your interest was politely declined.' };
    case 'MATCH_WITHDRAWN':          return { title: 'Interest withdrawn',        body: 'A pending interest was withdrawn.' };
    case 'MATCH_REQUEST_EXPIRED':    return { title: 'Interest expired',          body: 'A pending interest expired without a response.' };
    case 'NEW_MATCH':                return { title: 'New match',                 body: 'A new profile matches your preferences.' };
    case 'NEW_MESSAGE':              return { title: 'New message',               body: s('preview') || 'You have a new message.' };

    case 'MEETING_PROPOSED':  return { title: 'Video call proposed',  body: s('scheduledAt') ? `Proposed for ${s('scheduledAt')}.` : 'A video call was proposed.' };
    case 'MEETING_CONFIRMED': return { title: 'Video call confirmed', body: s('scheduledAt') ? `Confirmed for ${s('scheduledAt')}.` : 'Your video call is confirmed.' };
    case 'MEETING_REMINDER':  return { title: 'Video call reminder',  body: s('scheduledAt') ? `Starting ${s('scheduledAt')}.` : 'Your video call is starting soon.' };

    case 'CHURN_WINBACK_OFFER':  return { title: 'A little something to welcome you back', body: 'We saved your matches — pick up where you left off.' };
    case 'CHURN_RECOVERY_NUDGE': return { title: 'Your matches are waiting',              body: 'New profiles match your preferences. Take a look.' };
    case 'REENGAGE_NUDGE':       return { title: 'You have pending interests',             body: 'Someone is waiting to hear back from you.' };

    case 'NEW_BOOKING_REQUEST': return { title: 'New booking request', body: 'You have a new booking request to review.' };
    case 'BOOKING_CONFIRMED':   return { title: 'Booking confirmed',   body: 'Your booking has been confirmed.' };
    case 'BOOKING_CANCELLED':   return { title: 'Booking cancelled',   body: 'A booking was cancelled.' };

    case 'VENDOR_SUBMITTED':  return { title: 'Vendor profile submitted',    body: 'Your listing is under review.' };
    case 'VENDOR_APPROVED':   return { title: 'Vendor profile approved ✅',   body: s('businessName') ? `${s('businessName')} is now live.` : 'Your listing is now live.' };
    case 'VENDOR_REJECTED':   return { title: 'Vendor profile needs changes', body: s('reason') || 'Your listing needs updates before approval.' };
    case 'VENDOR_SUSPENDED':  return { title: 'Vendor profile suspended',    body: s('reason') || 'Your listing has been suspended.' };
    case 'VENDOR_REINSTATED': return { title: 'Vendor profile reinstated',   body: 'Your listing is active again.' };

    case 'PAYMENT_RECEIVED':      return { title: 'Payment received',    body: `${rupees} received.` };
    case 'PAYMENT_FAILED':
    case 'SUBSCRIPTION_FAILED':   return { title: 'Payment failed',      body: 'A payment could not be processed.' };
    case 'SUBSCRIPTION_RENEWED':  return { title: 'Subscription renewed', body: 'Your plan has been renewed.' };
    case 'ESCROW_RELEASED':       return { title: 'Funds released',      body: `${rupees} released from escrow.` };
    case 'REFUND_REQUESTED':      return { title: 'Refund requested',    body: 'A refund request was submitted.' };
    case 'REFUND_PROCESSED':
    case 'REFUND_COMPLETED':      return { title: 'Refund processed',    body: `${rupees} refunded.` };
    case 'PAYOUT_INITIATED':      return { title: 'Payout initiated',    body: `${rupees} is on its way to your account.` };
    case 'PAYOUT_FAILED':         return { title: 'Payout failed',       body: 'A payout could not be completed.' };
    case 'INVOICE_AVAILABLE':     return { title: 'Invoice available',   body: 'A new invoice is ready to view.' };
    case 'WALLET_CREDITED':       return { title: 'Wallet credited',     body: `${rupees} added to your wallet.` };
    case 'WALLET_DEBITED':        return { title: 'Wallet debited',      body: `${rupees} spent from your wallet.` };
    case 'PAYMENT_LINK_RECEIVED': return { title: 'Payment link received', body: 'You have a new payment link.' };
    case 'PROMO_APPLIED':         return { title: 'Promo applied',       body: 'A promo code was applied.' };

    case 'COORDINATOR_ASSIGNED': return { title: 'Coordinator assigned', body: 'A coordinator has been assigned to your wedding.' };
    case 'INCIDENT_RAISED':      return { title: 'Incident raised',      body: s('summary') || 'A day-of incident was reported.' };
    case 'CEREMONY_REMINDER':
    case 'CEREMONY_T_30D':
    case 'CEREMONY_T_7D':
    case 'CEREMONY_T_1D':
    case 'CEREMONY_T_1H':
    case 'COUNTDOWN':            return { title: 'Ceremony reminder', body: 'Your ceremony is coming up.' };
    case 'TASK_DUE':            return { title: 'Task due',          body: 'A wedding task is due soon.' };
    case 'RSVP_RECEIVED':       return { title: 'RSVP received',     body: 'A guest responded to your invitation.' };
    case 'RSVP_FOLLOWUP':       return { title: 'RSVP follow-up',    body: 'Some guests still need to respond.' };
    case 'VENDOR_PAYMENT':      return { title: 'Vendor payment due', body: 'A vendor payment is due.' };
    case 'GUEST_REMINDER':      return { title: 'Guest reminder',    body: 'A reminder about your guest list.' };
    case 'BUDGET_ALERT':        return { title: 'Budget alert',      body: s('message') || 'Your wedding budget needs attention.' };
    case 'DAY_OF_CHECKIN':      return { title: 'Day-of check-in',   body: 'Time for your day-of check-in.' };

    case 'PROFILE_REPORTED_MODERATION': return { title: 'Profile reported', body: 'A profile report needs moderation.' };

    default: {
      const explicit = s('title');
      return { title: explicit || humanize(type), body: s('body') };
    }
  }
}

function render(type: string, payload: Record<string, unknown>): RenderedContent {
  switch (type) {
    case 'NEW_CHAT_MESSAGE': {
      const senderName = (payload['senderName'] as string) ?? 'Someone';
      const preview    = (payload['preview']    as string) ?? '';
      const matchUrl   = (payload['matchUrl']   as string) ?? '';
      return {
        title: 'New message',
        body:  `${senderName}: ${preview.slice(0, 80)}`,
        email: emailTpl.newChatMessage({ senderName, preview, matchUrl }),
        sms:   smsTpl.newChatMessage({ senderName, preview }),
        ctaUrl: matchUrl,
      };
    }
    case 'PAYMENT_CAPTURED': {
      const amount     = Number(payload['amount']     ?? 0);
      const bookingId  = (payload['bookingId']  as string) ?? '';
      const receiptUrl = (payload['receiptUrl'] as string) ?? '';
      return {
        title: 'Payment received',
        body:  `₹${amount.toLocaleString('en-IN')} captured`,
        email: emailTpl.paymentCaptured({ amount, bookingId, receiptUrl }),
        sms:   smsTpl.paymentCaptured({ amount, bookingId }),
        ctaUrl: receiptUrl,
      };
    }
    case 'MEETING_INVITE': {
      const proposerName = (payload['proposerName'] as string) ?? 'Someone';
      const scheduledAt  = (payload['scheduledAt']  as string) ?? '';
      const durationMin  = Number(payload['durationMin'] ?? 30);
      const joinUrl      = (payload['joinUrl']      as string) ?? '';
      return {
        title: 'Video call invite',
        body:  `${proposerName} invited you at ${scheduledAt}`,
        email: emailTpl.meetingInvite({ proposerName, scheduledAt, durationMin, joinUrl }),
        sms:   smsTpl.meetingInvite({ proposerName, scheduledAt }),
        ctaUrl: joinUrl,
      };
    }
    case 'DISPUTE_RAISED':
    case 'DISPUTE_RAISED_VENDOR': {
      const bookingId = (payload['bookingId'] as string) ?? '';
      const reason    = (payload['reason']    as string) ?? '';
      const ctaUrl    = `/bookings/${bookingId}/dispute`;
      const title     = type === 'DISPUTE_RAISED_VENDOR'
        ? 'Customer raised a dispute'
        : 'Dispute raised';
      const body      = `Booking ${bookingId.slice(0, 8)}: ${reason.slice(0, 100)}`;
      return {
        title,
        body,
        email: emailTpl.genericNotification({ title, body, ctaUrl, ctaLabel: 'Review dispute' }),
        sms:   smsTpl.genericNotification({ title, body }),
        ctaUrl,
      };
    }
    case 'DISPUTE_NEEDS_REVIEW': {
      const bookingId = (payload['bookingId'] as string) ?? '';
      const reason    = (payload['reason']    as string) ?? '';
      const ctaUrl    = `/admin/escrow/${bookingId}`;
      const title     = 'Dispute needs admin review';
      const body      = `Booking ${bookingId.slice(0, 8)}: ${reason.slice(0, 100)}`;
      return {
        title,
        body,
        email: emailTpl.genericNotification({ title, body, ctaUrl, ctaLabel: 'Open admin panel' }),
        sms:   smsTpl.genericNotification({ title, body }),
        ctaUrl,
      };
    }
    case 'DISPUTE_RESOLVED': {
      const bookingId  = (payload['bookingId']  as string) ?? '';
      const resolution = (payload['resolution'] as string) ?? 'resolved';
      const title      = 'Dispute resolved';
      const body       = `Booking ${bookingId.slice(0, 8)}: ${resolution}`;
      const ctaUrl     = `/bookings/${bookingId}`;
      return {
        title,
        body,
        email: emailTpl.genericNotification({ title, body, ctaUrl, ctaLabel: 'View booking' }),
        sms:   smsTpl.genericNotification({ title, body }),
        ctaUrl,
      };
    }
    default: {
      const { title, body } = describe(type, payload);
      const ctaUrl   = deepLinkFor(type, payload);
      const ctaLabel = ctaLabelFor(type);
      const tplOpts: { title: string; body: string; ctaUrl?: string; ctaLabel?: string } = ctaUrl
        ? { title, body, ctaUrl, ctaLabel }
        : { title, body };
      return {
        title,
        body,
        email: emailTpl.genericNotification(tplOpts),
        sms:   smsTpl.genericNotification({ title, body }),
        ...(ctaUrl ? { ctaUrl } : {}),
      };
    }
  }
}

const TRANSACTIONAL_TYPES = new Set([
  'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED', 'ESCROW_RELEASED', 'REFUND_COMPLETED',
  'DISPUTE_RAISED', 'DISPUTE_RAISED_VENDOR', 'DISPUTE_NEEDS_REVIEW',
  'DISPUTE_RESOLVED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_FAILED',
]);

export async function deliverNotification(job: NotificationDeliveryJob): Promise<{ sentVia: SentVia[] }> {
  const { type, payload } = job;
  const sentVia: SentVia[] = [];

  const userId = await resolveRecipientUserId(job);
  if (!userId) {
    console.warn('[notifications] recipient resolution failed:', job.userId, job.profileId);
    return { sentVia };
  }

  const prefs = await getUserPrefs(userId);
  if (prefs.mutedTypes.includes(type)) return { sentVia };

  const contact = await getUserContact(userId);
  const isTransactional = TRANSACTIONAL_TYPES.has(type);
  const content = render(type, payload);
  const category = notificationCategory(type);
  // Bespoke render cases set their own ctaUrl; fall back to the derived deep
  // link so every notification is clickable and carries a route in `data`.
  const ctaUrl = content.ctaUrl && content.ctaUrl.length > 0
    ? content.ctaUrl
    : deepLinkFor(type, payload);

  // 1. Push — to all device tokens.
  if (prefs.push) {
    const tokens = await getDeviceTokens(userId);
    for (const t of tokens) {
      const pushPayload: Parameters<typeof sendPush>[0] = {
        token: t.token,
        title: content.title,
        body:  content.body,
        ...(ctaUrl ? { data: { url: ctaUrl, type } } : { data: { type } }),
      };
      const r = await sendPush(pushPayload);
      if (r.ok) sentVia.push('push');
    }
  }

  // 2. Email — only when contact present + pref enabled (or transactional).
  if (contact.email && (prefs.email || isTransactional)) {
    const r = await sendEmail({ to: contact.email, ...content.email });
    if (r.ok) sentVia.push('email');
  }

  // 3. SMS — only transactional or explicit opt-in.
  if (contact.phone && prefs.sms && isTransactional) {
    const r = await sendSms({ phone: contact.phone, message: content.sms });
    if (r.ok) sentVia.push('sms');
  }

  // 4. In-app — persist for the bell/panel, then push over the socket so open
  //    tabs update live. Persisted last so `sentVia` records every channel this
  //    notification actually went out on. `data` carries the canonical category,
  //    original job type and deep-link the UI needs.
  if (prefs.inApp || isTransactional) {
    const data = {
      ...payload,
      category,
      jobType: type,
      ...(ctaUrl ? { ctaUrl } : {}),
    };
    try {
      const [row] = await db
        .insert(notifications)
        .values({
          userId,
          type:    toNotificationEnum(type) as never,
          title:   content.title,
          body:    content.body,
          data,
          sentVia: [...sentVia, 'inapp'],
        })
        .returning({ id: notifications.id, createdAt: notifications.createdAt });
      sentVia.push('inapp');

      if (row) {
        emitNotification(userId, {
          id:        row.id,
          type:      toNotificationEnum(type),
          category,
          title:     content.title,
          body:      content.body,
          payload:   data,
          createdAt: row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : String(row.createdAt),
        });
      }
    } catch (err) {
      console.warn('[notifications] in-app insert failed:', err);
    }
  }

  return { sentVia };
}

// Job-type → DB-enum resolution lives in ./enum-map.ts (dependency-free so it's
// unit-testable). Re-exported here for callers/tests that import from service.
export { toNotificationEnum, isValidNotificationEnum } from './enum-map.js';
