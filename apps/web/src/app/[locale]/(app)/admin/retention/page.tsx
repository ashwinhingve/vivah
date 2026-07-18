import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { RetentionOverview } from './RetentionOverview.client';
import type { RetentionCampaign, RetentionStats } from '@smartshaadi/types';

interface AuthMe {
  userId: string;
  role: string;
  status: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminRetention.metadata' });
  return { title: t('title') };
}

export default async function RetentionAdminPage() {
  const t = await getTranslations('adminRetention');
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const [stats, campaigns] = await Promise.all([
    fetchAuth<RetentionStats>('/api/v1/admin/retention/stats'),
    fetchAuth<{ items: RetentionCampaign[]; total: number }>('/api/v1/admin/retention/campaigns?limit=50'),
  ]);

  return (
    <PageTransition className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t('backToAdmin')}
        </Link>

        <PageHeader
          title={t('heading')}
          subtitle={t('subtitle')}
        />

        <div className="mt-6">
          <RetentionOverview stats={stats} campaigns={campaigns?.items ?? []} />
        </div>
      </div>
    </PageTransition>
  );
}
