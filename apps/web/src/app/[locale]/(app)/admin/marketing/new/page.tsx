import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { CampaignForm } from './CampaignForm.client';

interface AuthMe {
  userId: string;
  role: string;
  status: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminMarketing.metadata' });
  return { title: t('newCampaign') };
}

export default async function NewCampaignPage() {
  const t = await getTranslations('adminMarketing');
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  return (
    <PageTransition className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/admin/marketing"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t('backToMarketing')}
        </Link>

        <PageHeader title={t('form.heading')} subtitle={t('form.subtitle')} />

        <div className="mt-6">
          <CampaignForm />
        </div>
      </div>
    </PageTransition>
  );
}
