import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Package, ListChecks } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper, OnboardingStepHeader } from '@/components/vendor/OnboardingStepper';
import { EmptyState } from '@/components/shared/EmptyState';
import { FadeUp } from '@/components/shared/FadeUp.client';
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

export default async function ServicesStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const t = await getTranslations('vendorRole.onboarding.services');

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const detail = await fetchAuth<VendorWithServices>(`/api/v1/vendors/${vendor.id}`);
  const services = detail?.services ?? [];

  return (
    <FadeUp>
      <OnboardingStepper current="services" />
      <OnboardingStepHeader
        icon={ListChecks}
        title={t('title')}
        subtitle={t('subtitle')}
      />

      {services.length > 0 && (
        <ul className="mb-5 space-y-2">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-gold/20 bg-surface px-4 py-3 shadow-card">
              <span className="text-sm font-medium text-primary">{s.name}</span>
              <span className="text-sm text-text-muted">
                ₹{s.priceFrom.toLocaleString('en-IN')}
                {s.priceTo ? `–${s.priceTo.toLocaleString('en-IN')}` : ''} · {s.unit}
              </span>
            </li>
          ))}
        </ul>
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
  );
}
