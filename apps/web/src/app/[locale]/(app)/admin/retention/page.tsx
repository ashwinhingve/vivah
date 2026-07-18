import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { RetentionOverview } from './RetentionOverview.client';
import type { RetentionCampaign, RetentionStats } from '@smartshaadi/types';

interface AuthMe {
  userId: string;
  role: string;
  status: string;
}

export default async function RetentionAdminPage() {
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const [stats, campaigns] = await Promise.all([
    fetchAuth<RetentionStats>('/api/v1/admin/retention/stats'),
    fetchAuth<{ items: RetentionCampaign[]; total: number }>('/api/v1/admin/retention/campaigns?limit=50'),
  ]);

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>

        <PageHeader
          title="Churn Recovery"
          subtitle="At-risk users the daily sweep flagged, and what happened after outreach."
        />

        <div className="mt-6">
          <RetentionOverview stats={stats} campaigns={campaigns?.items ?? []} />
        </div>
      </div>
    </div>
  );
}
