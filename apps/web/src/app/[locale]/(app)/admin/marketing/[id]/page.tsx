import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { ContentPanel } from './ContentPanel.client';
import { CampaignSendsTable } from './CampaignSendsTable.client';
import { CampaignTransitionButtons } from './CampaignTransitionButtons.client';
import type { MarketingCampaign, CampaignContent, CampaignSend } from '@smartshaadi/types';

interface AuthMe {
  userId: string;
  role: string;
  status: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminMarketing.metadata' });
  return { title: t('campaignDetail') };
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('adminMarketing');

  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const [campaign, content, sends] = await Promise.all([
    fetchAuth<MarketingCampaign>(`/api/v1/admin/marketing/${id}`),
    fetchAuth<{ items: CampaignContent[] }>(`/api/v1/admin/marketing/content/${id}`),
    fetchAuth<{ items: CampaignSend[] }>(`/api/v1/admin/marketing/${id}/sends?limit=50`),
  ]);

  if (!campaign) {
    return await redirect('/admin/marketing');
  }

  return (
    <PageTransition className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/marketing"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t('backToMarketing')}
        </Link>

        <PageHeader
          title={campaign.name}
          subtitle={campaign.description || t('noDescription')}
        />

        {/* Campaign metadata and transition buttons */}
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('campaignStatus')}</p>
              <span className="inline-block rounded-full border bg-teal/10 px-3 py-1 text-sm font-semibold text-teal">
                {t(`table.columns.statuses.${campaign.status.toLowerCase()}`)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 sm:pt-0">
              <CampaignTransitionButtons campaign={campaign} />
            </div>
          </div>
        </div>

        {/* Content panel */}
        <div className="mt-6">
          <ContentPanel campaignId={id} content={content?.items ?? []} />
        </div>

        {/* Sends table */}
        {sends && sends.items.length > 0 && (
          <div className="mt-6">
            <CampaignSendsTable sends={sends.items} />
          </div>
        )}
      </div>
    </PageTransition>
  );
}
