import { getTranslations } from 'next-intl/server';
import { Route as RouteIcon, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { RoleHero } from '@/components/shared/RoleHero';
import { RoutingForm } from './RoutingForm.client';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('coordinator');
  return { title: t('routingTitle') };
}

export default async function CoordinatorRoutingPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'EVENT_COORDINATOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('coordinator');

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
        <FadeUp>
          <Link
            href="/coordinator"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> {t('title')}
          </Link>
        </FadeUp>

        <RoleHero
          icon={RouteIcon}
          title={t('routingTitle')}
          subtitle={t('routingSubtitle')}
        />

        <div className="mt-6">
          <FadeUp delay={0.05}>
            <RoutingForm />
          </FadeUp>
        </div>
      </main>
    </PageTransition>
  );
}
