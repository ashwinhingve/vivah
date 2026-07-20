import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { WeddingNewForm } from './WeddingNewForm.client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'weddings.new' });
  return { title: t('metadata.title') };
}

export default async function NewWeddingPage() {
  const t = await getTranslations('weddings.new');

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-8 pb-24">
          <Link
            href="/weddings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('back')}
          </Link>

          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
          />

          <div className="mt-6 bg-surface border border-gold/20 rounded-2xl shadow-card p-6">
            <WeddingNewForm />
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
