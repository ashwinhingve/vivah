/**
 * Create B2B Account Page
 *
 * Form to create a new institutional buyer account with GSTIN validation.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { B2BAccountFormClient } from './form.client';
import { PageTransition } from '@/components/motion/PageTransition.client';

interface CreateB2BPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'b2b.create.metadata' });
  return { title: t('title') };
}

export default async function CreateB2BPage({ params }: CreateB2BPageProps) {
  const { locale } = await params;
  const t = await getTranslations('b2b.create');

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
          />

          <div className="rounded-2xl border border-gold/20 bg-surface p-8 shadow-card">
            <B2BAccountFormClient locale={locale} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
