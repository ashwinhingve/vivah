import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper, OnboardingStepHeader } from '@/components/vendor/OnboardingStepper';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { BusinessForm } from './BusinessForm.client';

export async function generateMetadata() {
  const t = await getTranslations('vendorRole.onboarding.business');
  return { title: t('metaTitle') };
}
export const dynamic = 'force-dynamic';

export default async function BusinessStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('vendorRole.onboarding.business');

  const vendor = await fetchMyVendor();

  return (
    <FadeUp>
      <OnboardingStepper current="business" />
      <OnboardingStepHeader
        icon={Building2}
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <BusinessForm vendor={vendor} />
    </FadeUp>
  );
}
