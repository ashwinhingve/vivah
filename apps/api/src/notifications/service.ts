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
import { sendPush } from './providers/fcm.js';
import { sendEmail } from './providers/ses.js';
import { sendSms } from './providers/msg91.js';
import * as emailTpl from './templates/email.js';
import * as smsTpl from './templates/sms.js';

type SentVia = 'push' | 'email' | 'sms' | 'inapp';

export type NotificationType =
  | 'NEW_CHAT_MESSAGE'
  | 'MATCH_REQUEST_RECEIVED'
  | 'MATCH_REQUEST_ACCEPTED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_FAILED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'ESCROW_RELEASED'
  | 'MEETING_INVITE'
  | 'MEETING_REMINDER'
  | 'REFUND_REQUESTED'
  | 'REFUND_COMPLETED'
  | 'DISPUTE_RAISED'
  | 'DISPUTE_RAISED_VENDOR'
  | 'DISPUTE_NEEDS_REVIEW'
  | 'DISPUTE_RESOLVED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_FAILED'
  | 'GENERIC';

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
  // Sentinel for moderator routing — not a real user.id.
  if (job.userId === 'admin') return job.userId;
  // Same value supplied for both fields (legacy matchmaking callers): treat
  // as a profileId and resolve. If a real userId was passed (no profileId
  // mismatch), the lookup will fail silently and we fall through to the raw
  // value, which the rest of the pipeline will treat as user.id.
  if (job.profileId && job.profileId === job.userId) {
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
      const title = (payload['title'] as string) ?? 'Smart Shaadi update';
      const body  = (payload['body']  as string) ?? '';
      const ctaUrl = payload['ctaUrl'] as string | undefined;
      const ctaLabel = payload['ctaLabel'] as string | undefined;
      const tplOpts: { title: string; body: string; ctaUrl?: string; ctaLabel?: string } = ctaUrl
        ? (ctaLabel ? { title, body, ctaUrl, ctaLabel } : { title, body, ctaUrl })
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

  // 1. In-app — always persist for transactional, gated by inApp flag for others.
  if (prefs.inApp || isTransactional) {
    try {
      await db.insert(notifications).values({
        userId,
        type:    (TYPE_ENUM_MAP[type] ?? 'INFO') as never,
        title:   content.title,
        body:    content.body,
        data:    payload,
        sentVia: [],
      });
      sentVia.push('inapp');
    } catch (err) {
      console.warn('[notifications] in-app insert failed:', err);
    }
  }

  // 2. Push — to all device tokens.
  if (prefs.push) {
    const tokens = await getDeviceTokens(userId);
    for (const t of tokens) {
      const pushPayload: Parameters<typeof sendPush>[0] = {
        token: t.token,
        title: content.title,
        body:  content.body,
        ...(content.ctaUrl ? { data: { url: content.ctaUrl, type } } : { data: { type } }),
      };
      const r = await sendPush(pushPayload);
      if (r.ok) sentVia.push('push');
    }
  }

  // 3. Email — only when contact present + pref enabled (or transactional).
  if (contact.email && (prefs.email || isTransactional)) {
    const r = await sendEmail({ to: contact.email, ...content.email });
    if (r.ok) sentVia.push('email');
  }

  // 4. SMS — only transactional or explicit opt-in.
  if (contact.phone && prefs.sms && isTransactional) {
    const r = await sendSms({ phone: contact.phone, message: content.sms });
    if (r.ok) sentVia.push('sms');
  }

  return { sentVia };
}

const TYPE_ENUM_MAP: Record<string, string> = {
  NEW_CHAT_MESSAGE:        'NEW_MESSAGE',
  MATCH_REQUEST_RECEIVED:  'NEW_MATCH',
  MATCH_REQUEST_ACCEPTED:  'MATCH_ACCEPTED',
  MATCH_REQUEST_DECLINED:  'MATCH_DECLINED',
  PAYMENT_CAPTURED:        'PAYMENT_RECEIVED',
  PAYMENT_FAILED:          'PAYMENT_FAILED',
  BOOKING_CONFIRMED:       'BOOKING_CONFIRMED',
  BOOKING_CANCELLED:       'BOOKING_CANCELLED',
  ESCROW_RELEASED:         'ESCROW_RELEASED',
  MEETING_INVITE:          'SYSTEM',
  MEETING_REMINDER:        'SYSTEM',
  REFUND_REQUESTED:        'REFUND_REQUESTED',
  REFUND_COMPLETED:        'REFUND_PROCESSED',
  DISPUTE_RAISED:          'SYSTEM',
  DISPUTE_RAISED_VENDOR:   'SYSTEM',
  DISPUTE_NEEDS_REVIEW:    'SYSTEM',
  DISPUTE_RESOLVED:        'SYSTEM',
  SUBSCRIPTION_RENEWED:    'PAYMENT_RECEIVED',
  SUBSCRIPTION_FAILED:     'PAYMENT_FAILED',
  GENERIC:                 'SYSTEM',
};
