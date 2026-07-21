import {
  Heart, Sparkles, MessageCircle, Video, CalendarClock,
  ShieldAlert, Wallet, CalendarCheck, Store, Bell, type LucideIcon,
} from 'lucide-react';
import {
  notificationCategory, deepLinkFor, notificationMeta,
  type NotificationCategory, type NotificationTone, type NotificationRow,
} from '@smartshaadi/types';

/** lucide icon component per category (mirrors notificationMeta[cat].icon names). */
export const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  MATCH:      Heart,
  INTEREST:   Sparkles,
  MESSAGE:    MessageCircle,
  VIDEO_CALL: Video,
  EVENT:      CalendarClock,
  PROFILE:    ShieldAlert,
  PAYMENT:    Wallet,
  BOOKING:    CalendarCheck,
  VENDOR:     Store,
  SYSTEM:     Bell,
};

/** Literal Tailwind classes per tone — kept literal so the JIT emits them. */
export const TONE_CLASSES: Record<NotificationTone, { text: string; bg: string }> = {
  primary:     { text: 'text-primary',     bg: 'bg-primary/10' },
  teal:        { text: 'text-teal',        bg: 'bg-teal/10' },
  gold:        { text: 'text-gold-muted',  bg: 'bg-gold/15' },
  success:     { text: 'text-success',     bg: 'bg-success/10' },
  destructive: { text: 'text-destructive', bg: 'bg-destructive/10' },
};

/**
 * Resolve a row's category. New rows carry `data.category`; older rows predate
 * that field, so fall back to deriving from the (coarse) DB enum `type`.
 */
export function rowCategory(n: NotificationRow): NotificationCategory {
  const c = n.data?.['category'];
  if (typeof c === 'string' && c in notificationMeta) return c as NotificationCategory;
  return notificationCategory(n.type);
}

/** Resolve a row's deep-link target (explicit ctaUrl, else derived). */
export function rowHref(n: NotificationRow): string | undefined {
  const cta = n.data?.['ctaUrl'];
  if (typeof cta === 'string' && cta.length > 0) return cta;
  const jt = n.data?.['jobType'];
  const jobType = typeof jt === 'string' ? jt : n.type;
  return deepLinkFor(jobType, n.data ?? {});
}

/** Compact relative age: "now", "5m", "3h", "2d", else a short date. Accepts locale param for date formatting. */
export function formatAge(iso: string, now: number, locale?: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 45) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const localeTag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return new Date(iso).toLocaleDateString(localeTag, { day: 'numeric', month: 'short' });
}

export type TimeBucket = 'today' | 'yesterday' | 'earlier';

export const TIME_BUCKETS: readonly TimeBucket[] = ['today', 'yesterday', 'earlier'];

/** Bucket a row by day relative to `now` (local time). Callers translate the key at render. */
export function timeBucket(iso: string, now: number): TimeBucket {
  const d = new Date(iso);
  const todayDate = new Date(now);
  const startOfToday = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return 'today';
  if (t >= startOfToday - 24 * 60 * 60 * 1000) return 'yesterday';
  return 'earlier';
}
