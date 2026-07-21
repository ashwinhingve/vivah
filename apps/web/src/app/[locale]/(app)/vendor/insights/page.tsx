import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { getTranslations, getLocale } from 'next-intl/server';
import { Eye, Heart, Star, MessageSquare, Users, CheckCircle2, IndianRupee, TrendingUp } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { fetchMyLeadStats } from '@/lib/vendor-leads-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import type { VendorReview } from '@smartshaadi/types';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('vendorRole.insights');
  return {
    title: t('metaTitle'),
  };
}

export const dynamic = 'force-dynamic';

async function inr(n: number, locale: string): Promise<string> {
  const numLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return `₹${Math.round(n).toLocaleString(numLocale)}`;
}

export default async function VendorInsightsPage() {
  const t = await getTranslations('vendorRole.insights');
  const locale = await getLocale();

  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const cookieStore = await cookies();
  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;

  const [reviewsRes, leadStats] = await Promise.all([
    fetchAuth<{ reviews: VendorReview[]; total: number }>(`/api/v1/vendors/${vendor.id}/reviews?limit=50`),
    fetchMyLeadStats(cookieHeader),
  ]);

  const reviews = reviewsRes?.reviews ?? [];
  const reviewCount = reviewsRes?.total ?? 0;
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  const qualifiedPct = leadStats && leadStats.totalLeads > 0
    ? Math.round((leadStats.qualifiedLeads / leadStats.totalLeads) * 100)
    : 0;

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
        <FadeUp>
          <PageHeader title={t('title')} subtitle={t('subtitle')} />
        </FadeUp>

        <StaggerList className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatsCard label={t('statProfileViews')} value={vendor.viewCount ?? 0} icon={Eye} variant="teal" />
          <StatsCard label={t('statSavedByCouples')} value={vendor.favoriteCount ?? 0} icon={Heart} variant="gold" />
          <StatsCard label={t('statAvgRating')} value={avgRating} icon={Star} variant="success" />
          <StatsCard label={t('statReviews')} value={reviewCount} icon={MessageSquare} href="/vendor/reviews" />
        </StaggerList>

        <FadeUp>
          <h2 className="mb-3 font-heading text-lg text-primary">{t('leadsHeading')}</h2>
          {leadStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatsCard label={t('statTotalLeads')} value={leadStats.totalLeads} icon={Users} />
                <StatsCard label={t('statQualified')} value={leadStats.qualifiedLeads} icon={CheckCircle2} variant="teal" />
                <StatsCard label={t('statThisMonth')} value={await inr(leadStats.monthChargedInr, locale)} icon={IndianRupee} variant="success" />
                <StatsCard label={t('statLifetime')} value={await inr(leadStats.lifetimeChargedInr, locale)} icon={TrendingUp} variant="gold" />
              </div>

              <div className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-primary">{t('qualifiedRate')}</span>
                  <span className="text-text-muted">{qualifiedPct}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${qualifiedPct}%` }} />
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  {t('leadsBreakdown', {
                    charged: leadStats.chargedLeads,
                    pending: leadStats.pendingLeads,
                    cancelled: leadStats.cancelledLeads,
                    avgFee: await inr(leadStats.avgFeeInr, locale),
                  })}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gold/20 bg-surface p-6 text-center text-sm text-text-muted shadow-card">
              {t('emptyLeads')}
            </div>
          )}
        </FadeUp>
      </main>
    </PageTransition>
  );
}
