import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { BlocksList } from './BlocksList.client';

export default async function BlockedProfilesPage() {
  const t = await getTranslations('settings');
  return (
    <PageTransition>
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
          <FadeUp>
            <Link href="/settings/privacy" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-4">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t('privacy')}
            </Link>
          </FadeUp>
          <FadeUp delay={0.1}>
            <PageHeader
              title={t('blocks')}
              subtitle={t('blocksDesc')}
            />
          </FadeUp>

          <FadeUp delay={0.2}>
            <BlocksList />
          </FadeUp>
        </div>
      </main>
    </PageTransition>
  );
}
