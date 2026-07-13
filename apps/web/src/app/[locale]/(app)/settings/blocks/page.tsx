import { getTranslations } from 'next-intl/server';
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
            <Link href="/settings/privacy" className="text-xs text-muted-foreground hover:text-primary inline-block mb-4">
              ← {t('privacy')}
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
