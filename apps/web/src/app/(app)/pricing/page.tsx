import { headers } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

interface Plan {
  id:       string;
  code:     string;
  name:     string;
  tier:     'STANDARD' | 'PREMIUM';
  interval: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  amount:   number;
  features: unknown;
}

async function fetchPlans(): Promise<Plan[]> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  try {
    const h = await headers();
    const cookie = h.get('cookie') ?? '';
    const res = await fetch(`${apiBase}/api/v1/payments/subscriptions/plans`, {
      cache:   'no-store',
      headers: { cookie },
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: Plan[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

function buildFallbackPlans(t: (key: string) => string): Plan[] {
  return [
    {
      id: 'fallback-free',
      code: 'FREE',
      name: t('fallback.freeName'),
      tier: 'STANDARD',
      interval: 'MONTHLY',
      amount: 0,
      features: [
        t('fallback.features.browseProfiles'),
        t('fallback.features.dailyLikes'),
        t('fallback.features.basicFilters'),
      ],
    },
    {
      id: 'fallback-standard',
      code: 'STANDARD_M',
      name: t('fallback.standardName'),
      tier: 'STANDARD',
      interval: 'MONTHLY',
      amount: 999,
      features: [
        t('fallback.features.unlimitedLikes'),
        t('fallback.features.seeWhoLiked'),
        t('fallback.features.advancedFilters'),
        t('fallback.features.prioritySupport'),
      ],
    },
    {
      id: 'fallback-premium',
      code: 'PREMIUM_M',
      name: t('fallback.premiumName'),
      tier: 'PREMIUM',
      interval: 'MONTHLY',
      amount: 1999,
      features: [
        t('fallback.features.everythingStandard'),
        t('fallback.features.verifiedBadge'),
        t('fallback.features.aiMatches'),
        t('fallback.features.readReceipts'),
        t('fallback.features.incognito'),
      ],
    },
    {
      id: 'fallback-premium-y',
      code: 'PREMIUM_Y',
      name: t('fallback.premiumAnnualName'),
      tier: 'PREMIUM',
      interval: 'YEARLY',
      amount: 19990,
      features: [
        t('fallback.features.allPremium'),
        t('fallback.features.twoMonthsFree'),
        t('fallback.features.concierge'),
        t('fallback.features.photoshoot'),
      ],
    },
  ];
}

export default async function PricingPage() {
  const t = await getTranslations('pricing');
  const fetched = await fetchPlans();
  const plans = fetched.length > 0 ? fetched : buildFallbackPlans(t);

  const intervalLabels: Record<Plan['interval'], string> = {
    MONTHLY:   t('interval.monthly'),
    QUARTERLY: t('interval.quarterly'),
    YEARLY:    t('interval.yearly'),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-primary">{t('header.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('header.subtitle')}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`rounded-xl border bg-surface p-6 shadow-sm ${plan.tier === 'PREMIUM' ? 'border-teal ring-2 ring-teal/20' : 'border-border'}`}
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-primary">{plan.name}</h2>
              {plan.tier === 'PREMIUM' && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-teal/10 text-teal">{t('badge.mostPopular')}</span>
              )}
            </div>
            <div className="mb-6">
              <span className="text-3xl font-bold text-foreground">₹{plan.amount.toLocaleString('en-IN')}</span>
              {plan.amount > 0 && <span className="text-sm text-muted-foreground">{intervalLabels[plan.interval]}</span>}
            </div>
            <ul className="mb-6 space-y-2 text-sm text-foreground">
              {(Array.isArray(plan.features) ? plan.features as string[] : []).map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={plan.amount === 0 ? '/dashboard' : `/settings/billing?plan=${plan.code}`}
              className={`block w-full text-center min-h-[44px] py-2.5 rounded-lg font-medium transition-colors ${
                plan.tier === 'PREMIUM'
                  ? 'bg-primary text-white hover:bg-teal'
                  : 'border border-primary text-primary hover:bg-primary/5'
              }`}
            >
              {plan.amount === 0 ? t('cta.free') : t('cta.paid')}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        {t.rich('footer', {
          billingLink: (chunks) => (
            <Link href="/settings/billing" className="text-teal hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </main>
  );
}
