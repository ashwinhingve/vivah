import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations, getLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { BillingConfirm } from './BillingConfirm.client';
import { PLANS_CONSTANT, monthlySavings } from '@smartshaadi/types';
import { localizePlanName, localizePlanFeatures } from '@/lib/plan-i18n';

interface Plan {
  id:       string;
  code:     string;
  name:     string;
  tier:     'STANDARD' | 'PREMIUM';
  interval: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  amount:   number;
  features: unknown;
}

const INTERVAL_KEYS: Record<Plan['interval'], string> = {
  MONTHLY:   'interval.month',
  QUARTERLY: 'interval.quarter',
  YEARLY:    'interval.year',
};

function intlLocale(locale: string): string {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}

// Derived from the shared PLANS_CONSTANT rather than restated, so a price can
// never be changed in one place and quietly disagree here. A hand-copied
// "mirror" is what let the page advertise one amount while Razorpay charged
// another — the failure mode is a refund and a chargeback, not a bug report.
// Used only when the API returns no plans (e.g. seed not yet run in a deployed
// env) so the page is never blank during a demo.
//
// `amount` is a decimal string in the constant (it maps to numeric(12,2)); this
// page renders a number.
const FALLBACK_PLANS: Plan[] = PLANS_CONSTANT.filter((p) => p.active).map((p) => ({
  id:       p.id,
  code:     p.code,
  name:     p.name,
  tier:     p.tier,
  interval: p.interval,
  amount:   Number(p.amount),
  features: p.features,
}));


async function fetchPlans(): Promise<Plan[]> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  try {
    const h = await headers();
    const cookie = h.get('cookie') ?? '';
    const res = await fetch(`${apiBase}/api/v1/payments/subscriptions/plans`, {
      cache:   'no-store',
      headers: { cookie },
    });
    if (!res.ok) return FALLBACK_PLANS;
    const json = await res.json() as { data?: Plan[] };
    const list = json.data ?? [];
    return list.length > 0 ? list : FALLBACK_PLANS;
  } catch {
    return FALLBACK_PLANS;
  }
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'billing.metadata' });
  return { title: t('title') };
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const t = await getTranslations('billing');
  const tSavings = await getTranslations('billingSavings');
  const tCatalog = await getTranslations('planCatalog');
  const locale = await getLocale();
  const numberLocale = intlLocale(locale);
  const { plan: planCode } = await searchParams;
  const plans = await fetchPlans();
  const isMock = process.env['USE_MOCK_SERVICES'] === 'true';

  if (planCode) {
    const plan = plans.find((p) => p.code === planCode) ?? null;
    if (plan) {
      return (
        <PageTransition>
          <main className="mx-auto max-w-2xl px-4 py-8">
            <FadeUp>
              <PageHeader
                title={t('confirmHeading')}
                subtitle={t('confirmSubtitle')}
              />
            </FadeUp>
            <FadeUp delay={0.1}>
              <BillingConfirm
                planCode={plan.code}
                planName={localizePlanName(tCatalog, plan.code, plan.name)}
                amount={plan.amount}
                interval={INTERVAL_KEYS[plan.interval] ? t(INTERVAL_KEYS[plan.interval]) : plan.interval}
                features={localizePlanFeatures(tCatalog, plan.features)}
                isMock={isMock}
              />
            </FadeUp>
            <FadeUp delay={0.2} className="mt-6 text-center">
              <Link href="/settings/billing" className="inline-flex items-center gap-1 text-teal hover:text-teal-hover text-sm">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t('chooseDifferentPlan')}
              </Link>
            </FadeUp>
          </main>
        </PageTransition>
      );
    }
  }

  return (
    <PageTransition>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <FadeUp>
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
          />
        </FadeUp>
        {isMock ? (
          <FadeUp delay={0.1}>
            <div className="mx-auto mb-8 max-w-2xl rounded-lg border border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
              {t('testMode')}
            </div>
          </FadeUp>
        ) : null}
        <FadeUp delay={isMock ? 0.2 : 0.1}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const features = localizePlanFeatures(tCatalog, plan.features);
              const isPremium = plan.tier === 'PREMIUM';

              // Calculate savings against monthly plan of same tier
              const planRowInConstant = PLANS_CONSTANT.find((p) => p.code === plan.code);
              const savings = planRowInConstant ? monthlySavings(planRowInConstant, PLANS_CONSTANT) : null;

              return (
                <div
                  key={plan.code}
                  className={`flex flex-col rounded-xl border bg-surface p-6 shadow-card ${
                    isPremium ? 'border-gold/60' : 'border-gold/30'
                  }`}
                >
                  {isPremium ? (
                    <span className="mb-2 inline-block w-fit rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold-muted">
                      {t('badgePremium')}
                    </span>
                  ) : null}
                  <h2 className="mb-1 text-xl font-semibold text-primary">{localizePlanName(tCatalog, plan.code, plan.name)}</h2>
                  <p className="mb-4 text-2xl font-bold text-foreground">
                    ₹{plan.amount.toLocaleString(numberLocale)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      / {INTERVAL_KEYS[plan.interval] ? t(INTERVAL_KEYS[plan.interval]) : plan.interval}
                    </span>
                  </p>
                  {savings ? (
                    <p className="mb-4 rounded-lg bg-gold/10 px-3 py-2 text-xs font-medium text-gold-muted">
                      {tSavings('savingsLabel', {
                        amount: savings.savedAmount.toLocaleString(numberLocale),
                        percent: savings.percent,
                      })}
                    </p>
                  ) : null}
                  {features.length > 0 ? (
                    <ul className="mb-6 flex-1 space-y-2 text-sm text-foreground">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="mt-0.5 text-success">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Button asChild className="mt-auto w-full">
                    <Link href={`/settings/billing?plan=${plan.code}`}>{t('subscribe')}</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </FadeUp>
      </main>
    </PageTransition>
  );
}
