import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { Check, Minus, ClipboardCheck } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor, fetchVendorStatus } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper, OnboardingStepHeader } from '@/components/vendor/OnboardingStepper';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { SubmitReview } from './SubmitReview.client';

export async function generateMetadata() {
  const t = await getTranslations('vendorRole.onboarding.review');
  return { title: t('metaTitle') };
}
export const dynamic = 'force-dynamic';

interface ServiceRow { id: string }
interface VendorDetail {
  id: string;
  businessName?: string;
  category?: string;
  city?: string;
  state?: string;
  services?: ServiceRow[];
}
interface PortfolioBasics { about?: string | null }

function Row({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          done ? 'bg-success/15 text-success' : 'bg-surface-muted text-text-muted'
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
      </span>
      <span className={done ? 'text-sm text-primary' : 'text-sm text-text-muted'}>{label}</span>
    </li>
  );
}

export default async function ReviewStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const t = await getTranslations('vendorRole.onboarding.review');

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const [detail, portfolioRes, eventTypesRes, status] = await Promise.all([
    fetchAuth<VendorDetail>(`/api/v1/vendors/${vendor.id}`),
    fetchAuth<{ portfolio: PortfolioBasics | null }>(`/api/v1/vendors/${vendor.id}/portfolio`),
    fetchAuth<{ eventTypes: string[] }>(`/api/v1/vendors/${vendor.id}/event-types`),
    fetchVendorStatus(),
  ]);

  const hasBusiness = Boolean(detail?.businessName && detail?.category && detail?.city);
  const serviceCount = detail?.services?.length ?? 0;
  const hasServices = serviceCount > 0;
  const hasAbout = Boolean(portfolioRes?.portfolio?.about);
  const eventTypeCount = eventTypesRes?.eventTypes?.length ?? 0;

  const canSubmit = hasBusiness && hasServices;
  const alreadySubmitted = status?.status === 'PENDING' || status?.status === 'UNDER_REVIEW' || status?.status === 'APPROVED';

  return (
    <PageTransition>
      <FadeUp>
        <OnboardingStepper current="review" />
        <OnboardingStepHeader
          icon={ClipboardCheck}
          title={t('title')}
          subtitle={t('subtitle')}
        />

        <div className="mb-5 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
          <ul className="divide-y divide-border">
            <Row done={hasBusiness} label={hasBusiness ? t('businessDone', { name: detail?.businessName ?? '' }) : t('businessTodo')} />
            <Row done={hasServices} label={hasServices ? t('servicesDone', { count: serviceCount }) : t('servicesTodo')} />
            <Row done={hasAbout} label={hasAbout ? t('aboutDone') : t('aboutTodo')} />
            <Row done={eventTypeCount > 0} label={eventTypeCount > 0 ? t('eventTypesDone', { count: eventTypeCount }) : t('eventTypesTodo')} />
          </ul>
        </div>

        <SubmitReview canSubmit={canSubmit} alreadySubmitted={alreadySubmitted} />
      </FadeUp>
    </PageTransition>
  );
}
