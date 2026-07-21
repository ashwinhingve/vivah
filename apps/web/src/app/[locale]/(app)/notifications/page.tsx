import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { NotificationsPageClient } from '@/components/notifications/NotificationsPageClient.client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'notifications.metadata' });
  return { title: t('title') };
}

/**
 * Notifications page — a thin shell over the app-wide NotificationsProvider
 * (mounted in the (app) layout). All data + realtime updates flow through that
 * context, so this route needs no fetch of its own; the client component adds
 * filter tabs, time-bucket grouping, and per-item / bulk actions.
 */
export default function NotificationsPage() {
  return <NotificationsPageClient />;
}
