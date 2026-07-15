import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { NotificationPrefsClient } from './NotificationPrefsClient.client';

interface Prefs {
  push:      boolean;
  sms:       boolean;
  email:     boolean;
  inApp:     boolean;
  marketing: boolean;
  mutedTypes: string[];
}

async function fetchPrefs(): Promise<Prefs> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  try {
    const res = await fetch(`${apiBase}/api/v1/users/me/notification-preferences`, {
      cache:   'no-store',
      headers: { cookie },
    });
    if (!res.ok) throw new Error('failed');
    const json = await res.json() as { data?: Prefs };
    return json.data ?? { push: true, sms: true, email: true, inApp: true, marketing: false, mutedTypes: [] };
  } catch {
    return { push: true, sms: true, email: true, inApp: true, marketing: false, mutedTypes: [] };
  }
}

export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage() {
  const t = await getTranslations('settings');
  const prefs = await fetchPrefs();
  return (
    <PageTransition>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <FadeUp>
          <PageHeader
            title={t('notifications')}
            subtitle={t('notificationsDesc')}
          />
        </FadeUp>
        <FadeUp delay={0.1}>
          <NotificationPrefsClient initial={prefs} />
        </FadeUp>
      </main>
    </PageTransition>
  );
}
