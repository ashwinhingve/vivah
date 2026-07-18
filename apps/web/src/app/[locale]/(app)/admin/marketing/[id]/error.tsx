'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { PageTransition } from '@/components/motion/PageTransition.client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CampaignDetailError({ error, reset }: ErrorProps) {
  const t = useTranslations('errors');
  const router = useRouter();

  return (
    <PageTransition className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
          <p className="text-gray-600">{t('description')}</p>
          <p className="text-sm text-gray-500">{error.message}</p>

          <div className="flex gap-3 justify-center pt-4">
            <button
              onClick={reset}
              className="inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90"
            >
              {t('retry')}
            </button>
            <button
              onClick={() => router.push('/admin/marketing')}
              className="inline-flex h-11 items-center rounded-lg border border-gold-muted px-6 text-sm font-semibold text-primary hover:bg-background"
            >
              {t('backToMarketing')}
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
