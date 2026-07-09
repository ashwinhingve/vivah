import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor, fetchVendorBlockedDates } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper, OnboardingStepHeader } from '@/components/vendor/OnboardingStepper';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { AvailabilityManager } from './AvailabilityManager.client';

export async function generateMetadata() {
  const t = await getTranslations('vendorRole.onboarding.availability');
  return { title: t('metaTitle') };
}
export const dynamic = 'force-dynamic';

export default async function AvailabilityStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('vendorRole.onboarding.availability');

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const blocked = await fetchVendorBlockedDates();
  const dates = (blocked?.dates ?? []).map((d) => ({
    id: d.id,
    date: d.date,
    reason: d.reason ?? null,
  }));

  return (
    <FadeUp>
      <OnboardingStepper current="availability" />
      <OnboardingStepHeader
        icon={CalendarDays}
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <AvailabilityManager initial={dates} />

      <div className="mt-6 flex justify-end">
        <Link
          href="/vendor/onboarding/bank"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90"
        >
          {t('continue')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </FadeUp>
  );
}
