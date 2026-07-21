import type { Metadata } from 'next';
import { redirect } from '@/i18n/redirect';
import { Star, MessageSquare } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { getTranslations, getLocale } from 'next-intl/server';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { VendorReviewReply } from '@/components/vendor/VendorReviewReply.client';
import { cn } from '@/lib/utils';
import type { VendorReview } from '@smartshaadi/types';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('vendorRole.reviews');
  return {
    title: t('metaTitle'),
  };
}

export const dynamic = 'force-dynamic';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-4 w-4', n <= rating ? 'fill-gold text-gold' : 'text-border')} />
      ))}
    </span>
  );
}

export default async function VendorReviewsPage() {
  const t = await getTranslations('vendorRole.reviews');
  const locale = await getLocale();

  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const data = await fetchAuth<{ reviews: VendorReview[]; total: number }>(
    `/api/v1/vendors/${vendor.id}/reviews?limit=50`,
  );
  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const subtitle = avg
    ? t('subtitleWithAvg', { avg, total })
    : t('subtitleEmpty');

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-8">
        <FadeUp>
          <PageHeader
            title={t('title')}
            subtitle={subtitle}
          />
        </FadeUp>

        {reviews.length === 0 ? (
          <FadeUp>
            <EmptyState
              icon={MessageSquare}
              title={t('emptyTitle')}
              description={t('emptyDescription')}
            />
          </FadeUp>
        ) : (
          <StaggerList className="space-y-3">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} locale={locale} />
            ))}
          </StaggerList>
        )}
      </main>
    </PageTransition>
  );
}

async function ReviewCard({ review: r, locale }: { review: VendorReview; locale: string }) {
  const t = await getTranslations('vendorRole.reviews');
  const dateLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const date = new Date(r.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Stars rating={r.rating} />
          <span className="text-sm font-medium text-primary">{r.reviewerName}</span>
        </div>
        <span className="text-xs text-text-muted">{date}</span>
      </div>

      {r.title && <p className="mt-2 text-sm font-medium text-primary">{r.title}</p>}
      {r.comment && <p className="mt-1 whitespace-pre-wrap text-sm text-text">{r.comment}</p>}

      {r.vendorReply ? (
        <div className="mt-3 rounded-lg border-l-2 border-teal/40 bg-teal/5 px-3 py-2">
          <p className="text-xs font-medium text-teal">{t('yourReply')}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-text">{r.vendorReply}</p>
        </div>
      ) : (
        <div className="mt-3">
          <VendorReviewReply reviewId={r.id} />
        </div>
      )}
    </div>
  );
}
