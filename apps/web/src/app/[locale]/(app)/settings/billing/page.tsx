import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { BillingConfirm } from './BillingConfirm.client';

interface Plan {
  id:       string;
  code:     string;
  name:     string;
  tier:     'STANDARD' | 'PREMIUM';
  interval: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  amount:   number;
  features: unknown;
}

const INTERVAL_LABELS: Record<Plan['interval'], string> = {
  MONTHLY:   'month',
  QUARTERLY: 'quarter',
  YEARLY:    'year',
};

// Mirror of packages/db/seed/full-demo.ts PLAN_ROWS. Used as a fallback
// when the API returns no plans (e.g. seed not yet run in a deployed env)
// so the page is never blank during demos.
const FALLBACK_PLANS: Plan[] = [
  {
    id:       'fallback-standard-m',
    code:     'STANDARD_M',
    name:     'Standard Monthly',
    tier:     'STANDARD',
    interval: 'MONTHLY',
    amount:   999,
    features: ['Unlimited matches', 'Basic filters', 'Chat'],
  },
  {
    id:       'fallback-standard-y',
    code:     'STANDARD_Y',
    name:     'Standard Yearly',
    tier:     'STANDARD',
    interval: 'YEARLY',
    amount:   8999,
    features: ['Unlimited matches', 'Basic filters', 'Chat', '2 months free'],
  },
  {
    id:       'fallback-premium-m',
    code:     'PREMIUM_M',
    name:     'Premium Monthly',
    tier:     'PREMIUM',
    interval: 'MONTHLY',
    amount:   2499,
    features: ['All Standard features', 'AI matchmaking', 'Priority support', 'Family access'],
  },
  {
    id:       'fallback-premium-y',
    code:     'PREMIUM_Y',
    name:     'Premium Yearly',
    tier:     'PREMIUM',
    interval: 'YEARLY',
    amount:   22999,
    features: ['All Standard features', 'AI matchmaking', 'Priority support', 'Family access', '2 months free'],
  },
];

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

function featureList(features: unknown): string[] {
  return Array.isArray(features)
    ? features.filter((f): f is string => typeof f === 'string')
    : [];
}

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
  const { plan: planCode } = await searchParams;
  const plans = await fetchPlans();
  const isMock = process.env['USE_MOCK_SERVICES'] === 'true';

  if (planCode) {
    const plan = plans.find((p) => p.code === planCode) ?? null;
    if (plan) {
      return (
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="mb-2 text-center font-heading text-3xl font-semibold text-primary">Complete your subscription</h1>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            Review your plan and confirm to activate.
          </p>
          <BillingConfirm
            planCode={plan.code}
            planName={plan.name}
            amount={plan.amount}
            interval={INTERVAL_LABELS[plan.interval] ?? plan.interval}
            features={featureList(plan.features)}
            isMock={isMock}
          />
          <p className="mt-6 text-center text-sm">
            <Link href="/settings/billing" className="text-teal hover:underline">
              ← Choose a different plan
            </Link>
          </p>
        </main>
      );
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-2 text-center font-heading text-3xl font-semibold text-primary">{t('heading')}</h1>
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Unlock unlimited matches, AI matchmaking, and priority support.
      </p>
      {isMock ? (
        <div className="mx-auto mb-8 max-w-2xl rounded-lg border border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
          Test Mode — no real charge will be made
        </div>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const features = featureList(plan.features);
          const isPremium = plan.tier === 'PREMIUM';
          return (
            <div
              key={plan.code}
              className={`flex flex-col rounded-xl border bg-surface p-6 shadow-card ${
                isPremium ? 'border-gold/60' : 'border-gold/30'
              }`}
            >
              {isPremium ? (
                <span className="mb-2 inline-block w-fit rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold-muted">
                  Premium
                </span>
              ) : null}
              <h2 className="mb-1 text-xl font-semibold text-primary">{plan.name}</h2>
              <p className="mb-4 text-2xl font-bold text-foreground">
                ₹{plan.amount.toLocaleString('en-IN')}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {INTERVAL_LABELS[plan.interval] ?? plan.interval}
                </span>
              </p>
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
                <Link href={`/settings/billing?plan=${plan.code}`}>Subscribe</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
