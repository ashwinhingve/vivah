import { redirect } from '@/i18n/redirect';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Landmark, ShieldCheck } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor, fetchVendorStatus } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper, OnboardingStepHeader } from '@/components/vendor/OnboardingStepper';
import { FadeUp } from '@/components/shared/FadeUp.client';

export const metadata = { title: 'Payouts · Vendor onboarding' };
export const dynamic = 'force-dynamic';

export default async function BankStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const status = await fetchVendorStatus();
  const approved = status?.status === 'APPROVED';

  return (
    <FadeUp>
      <OnboardingStepper current="bank" />
      <OnboardingStepHeader
        icon={Landmark}
        title="Payouts"
        subtitle="How you get paid for bookings. No action needed from you right now."
      />

      <div className="space-y-4 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal/10">
            <Landmark className="h-5 w-5 text-teal" />
          </span>
          <div>
            <p className="text-sm font-medium text-primary">Bank verification is handled during review</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Our team verifies your payout account as part of approving your profile — a secure
              penny-drop check. You don’t need to enter bank details here. Once approved, payouts
              from confirmed bookings settle to your verified account automatically.
            </p>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            approved
              ? 'border-success/30 bg-success/5 text-success'
              : 'border-gold/30 bg-gold/5 text-gold-muted'
          }`}
        >
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {approved
            ? 'Your account is approved — payouts are enabled.'
            : 'Payouts unlock once your profile is approved in the next step.'}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Link
          href="/vendor/onboarding/review"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90"
        >
          Continue to review <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </FadeUp>
  );
}
