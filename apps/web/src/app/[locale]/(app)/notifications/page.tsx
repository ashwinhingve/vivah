import type { Metadata } from 'next';
import { NotificationsPageClient } from '@/components/notifications/NotificationsPageClient.client';

export const metadata: Metadata = { title: 'Notifications' };

/**
 * Notifications page — a thin shell over the app-wide NotificationsProvider
 * (mounted in the (app) layout). All data + realtime updates flow through that
 * context, so this route needs no fetch of its own; the client component adds
 * filter tabs, time-bucket grouping, and per-item / bulk actions.
 */
export default function NotificationsPage() {
  return <NotificationsPageClient />;
}
