import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper } from '@/components/vendor/OnboardingStepper';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { BusinessForm } from './BusinessForm.client';

export const metadata = { title: 'Business · Vendor onboarding' };
export const dynamic = 'force-dynamic';

export default async function BusinessStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const vendor = await fetchMyVendor();

  return (
    <FadeUp>
      <OnboardingStepper current="business" />
      <div className="mb-4">
        <h2 className="font-heading text-lg text-primary">Tell us about your business</h2>
        <p className="text-sm text-muted-foreground">
          This is what couples see first. You can refine it anytime after launch.
        </p>
      </div>
      <BusinessForm vendor={vendor} />
    </FadeUp>
  );
}
