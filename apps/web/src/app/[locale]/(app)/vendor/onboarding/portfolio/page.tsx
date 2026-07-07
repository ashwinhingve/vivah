import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper } from '@/components/vendor/OnboardingStepper';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { PortfolioForm } from './PortfolioForm.client';
import type { EventTypeValue } from '@smartshaadi/schemas';

export const metadata = { title: 'Portfolio · Vendor onboarding' };
export const dynamic = 'force-dynamic';

interface PortfolioBasics {
  about?: string | null;
  awards?: string[] | null;
  certifications?: string[] | null;
}

export default async function PortfolioStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const [portfolioRes, eventTypesRes] = await Promise.all([
    fetchAuth<{ portfolio: PortfolioBasics | null }>(`/api/v1/vendors/${vendor.id}/portfolio`),
    fetchAuth<{ eventTypes: EventTypeValue[] }>(`/api/v1/vendors/${vendor.id}/event-types`),
  ]);

  const p = portfolioRes?.portfolio ?? null;

  return (
    <FadeUp>
      <OnboardingStepper current="portfolio" />
      <div className="mb-4">
        <h2 className="font-heading text-lg text-primary">Portfolio &amp; credentials</h2>
        <p className="text-sm text-muted-foreground">
          Photos &amp; videos can be added from your dashboard after launch. Set the essentials here.
        </p>
      </div>
      <PortfolioForm
        vendorId={vendor.id}
        about={p?.about ?? ''}
        awards={p?.awards ?? []}
        certifications={p?.certifications ?? []}
        selectedEventTypes={eventTypesRes?.eventTypes ?? []}
      />
    </FadeUp>
  );
}
