import { redirect } from '@/i18n/redirect';
import { Images } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper, OnboardingStepHeader } from '@/components/vendor/OnboardingStepper';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { PortfolioForm } from './PortfolioForm.client';
import { PackageManager, type VendorPackageView } from '@/components/vendor/PackageManager.client';
import { PortfolioItemManager, type VendorPortfolioItemView } from '@/components/vendor/PortfolioItemManager.client';
import type { EventTypeValue } from '@smartshaadi/schemas';

export const metadata = { title: 'Portfolio · Vendor onboarding' };
export const dynamic = 'force-dynamic';

interface PortfolioBasics {
  about?: string | null;
  awards?: string[] | null;
  certifications?: string[] | null;
  portfolio?: VendorPortfolioItemView[] | null;
}

export default async function PortfolioStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const [portfolioRes, eventTypesRes, packagesRes] = await Promise.all([
    fetchAuth<{ portfolio: PortfolioBasics | null }>(`/api/v1/vendors/${vendor.id}/portfolio`),
    fetchAuth<{ eventTypes: EventTypeValue[] }>(`/api/v1/vendors/${vendor.id}/event-types`),
    fetchAuth<{ packages: VendorPackageView[] }>(`/api/v1/vendors/${vendor.id}/packages`),
  ]);

  const p = portfolioRes?.portfolio ?? null;

  return (
    <FadeUp>
      <OnboardingStepper current="portfolio" />
      <OnboardingStepHeader
        icon={Images}
        title="Portfolio & credentials"
        subtitle="Set your essentials, packages and work samples — this is what couples browse before enquiring."
      />
      <PortfolioForm
        vendorId={vendor.id}
        about={p?.about ?? ''}
        awards={p?.awards ?? []}
        certifications={p?.certifications ?? []}
        selectedEventTypes={eventTypesRes?.eventTypes ?? []}
      />

      <div className="mt-6">
        <PackageManager vendorId={vendor.id} initial={packagesRes?.packages ?? []} />
      </div>

      <div className="mt-6">
        <PortfolioItemManager vendorId={vendor.id} initial={p?.portfolio ?? []} />
      </div>
    </FadeUp>
  );
}
