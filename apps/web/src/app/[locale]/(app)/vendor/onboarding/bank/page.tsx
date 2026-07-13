import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Landmark, ShieldCheck } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor, fetchVendorStatus } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper, OnboardingStepHeader } from '@/components/vendor/OnboardingStepper';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';

export async function generateMetadata() {
  const t = await getTranslations('vendorRole.onboarding.bank');
  return { title: t('metaTitle') };
}
export const dynamic = 'force-dynamic';

export default async function BankStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('vendorRole.onboarding.bank');

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const status = await fetchVendorStatus();
  const approved = status?.status === 'APPROVED';

  return (
    <PageTransition>
      <FadeUp>
        <OnboardingStepper current="bank" />
        <OnboardingStepHeader
          icon={Landmark}
          title={t('title')}
          subtitle={t('subtitle')}
        />

        <div className="space-y-4 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal/10">
              <Landmark className="h-5 w-5 text-teal" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-primary">{t('verifyTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('verifyBody')}
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
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {approved ? t('approved') : t('pending')}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Link
            href="/vendor/onboarding/review"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90"
          >
            {t('continue')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </FadeUp>
    </PageTransition>
  );
}
