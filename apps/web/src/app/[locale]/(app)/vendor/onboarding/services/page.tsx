import { redirect } from '@/i18n/redirect';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Package, ListChecks } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper, OnboardingStepHeader } from '@/components/vendor/OnboardingStepper';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { AddServiceForm } from './AddServiceForm.client';

export async function generateMetadata() {
  const t = await getTranslations('vendorRole.onboarding.services');
  return { title: t('metaTitle') };
}
export const dynamic = 'force-dynamic';

interface ServiceRow {
  id: string;
  name: string;
  priceFrom: number;
  priceTo: number | null;
  unit: string;
}
interface VendorWithServices {
  id: string;
  services?: ServiceRow[];
}

const UNIT_LABEL_KEY: Record<string, string> = {
  per_event:  'serviceUnits.per_event',
  per_day:    'serviceUnits.per_day',
  per_hour:   'serviceUnits.per_hour',
  per_plate:  'serviceUnits.per_plate',
  per_person: 'serviceUnits.per_person',
  fixed:      'serviceUnits.fixed',
};

export default async function ServicesStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const t = await getTranslations('vendorRole.onboarding.services');
  const tLabels = await getTranslations('vendorRole.onboarding.labels');
  const locale = await getLocale();
  const numLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const detail = await fetchAuth<VendorWithServices>(`/api/v1/vendors/${vendor.id}`);
  const services = detail?.services ?? [];

  return (
    <PageTransition>
      <FadeUp>
        <OnboardingStepper current="services" />
        <OnboardingStepHeader
          icon={ListChecks}
          title={t('title')}
          subtitle={t('subtitle')}
        />

        {services.length > 0 && (
          <StaggerList className="mb-5 space-y-2">
            {services.map((s) => {
              const unitKey = UNIT_LABEL_KEY[s.unit];
              return (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-gold/20 bg-surface px-4 py-3 shadow-card">
                  <span className="text-sm font-medium text-primary">{s.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ₹{s.priceFrom.toLocaleString(numLocale)}
                    {s.priceTo ? `–${s.priceTo.toLocaleString(numLocale)}` : ''} · {unitKey ? tLabels(unitKey) : s.unit}
                  </span>
                </div>
              );
            })}
          </StaggerList>
        )}

        {services.length === 0 && (
          <div className="mb-5">
            <EmptyState icon={Package} title={t('emptyTitle')} description={t('emptyDesc')} />
          </div>
        )}

        <AddServiceForm vendorId={vendor.id} />

        <div className="mt-6 flex justify-end">
          <Link
            href="/vendor/onboarding/portfolio"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90"
          >
            {t('continue')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </FadeUp>
    </PageTransition>
  );
}
