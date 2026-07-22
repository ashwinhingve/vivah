import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
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

type FallbackSlug = 'free' | 'standard' | 'premium' | 'premiumAnnual';

const FALLBACK_PLANS_BASE: (Omit<Plan, 'name'> & { name: FallbackSlug })[] = [
  { id: 'fallback-free',     code: 'FREE',           name: 'free',           tier: 'STANDARD' as const, interval: 'MONTHLY' as const,  amount: 0,    features: [] },
  { id: 'fallback-standard', code: 'STANDARD_M',     name: 'standard',       tier: 'STANDARD' as const, interval: 'MONTHLY' as const,  amount: 999,  features: [] },
  { id: 'fallback-premium',  code: 'PREMIUM_M',      name: 'premium',        tier: 'PREMIUM' as const,  interval: 'MONTHLY' as const,  amount: 1999, features: [] },
  { id: 'fallback-premium-y', code: 'PREMIUM_Y',     name: 'premiumAnnual',  tier: 'PREMIUM' as const,  interval: 'YEARLY' as const,   amount: 19990, features: [] },
];

const FALLBACK_PLAN_KEYS: Record<FallbackSlug, { name: string; features: string[] }> = {
  free: {
    name: 'fallbackPlans.free.name',
    features: ['fallbackPlans.free.features.f1', 'fallbackPlans.free.features.f2', 'fallbackPlans.free.features.f3'],
  },
  standard: {
    name: 'fallbackPlans.standard.name',
    features: ['fallbackPlans.standard.features.f1', 'fallbackPlans.standard.features.f2', 'fallbackPlans.standard.features.f3', 'fallbackPlans.standard.features.f4'],
  },
  premium: {
    name: 'fallbackPlans.premium.name',
    features: ['fallbackPlans.premium.features.f1', 'fallbackPlans.premium.features.f2', 'fallbackPlans.premium.features.f3', 'fallbackPlans.premium.features.f4', 'fallbackPlans.premium.features.f5'],
  },
  premiumAnnual: {
    name: 'fallbackPlans.premiumAnnual.name',
    features: ['fallbackPlans.premiumAnnual.features.f1', 'fallbackPlans.premiumAnnual.features.f2', 'fallbackPlans.premiumAnnual.features.f3', 'fallbackPlans.premiumAnnual.features.f4'],
  },
};

const INTERVAL_KEY: Record<Plan['interval'], string> = {
  MONTHLY:   'interval.month',
  QUARTERLY: 'interval.quarter',
  YEARLY:    'interval.year',
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing.metadata' });
  return { title: t('title') };
}

function intlLocale(locale: string): string {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}

export default async function PricingPage() {
  const t = await getTranslations('pricing');
  const tCatalog = await getTranslations('planCatalog');
  const locale = await getLocale();
  const fetched = await fetchPlans();

  // API plans carry English DB strings — localize via the code/literal maps in
  // plan-i18n. Fallback plans hydrate from their own i18n keys (FALLBACK_PLAN_KEYS).
  const plans: Plan[] = fetched.length > 0
    ? fetched.map(p => ({
        ...p,
        name: localizePlanName(tCatalog, p.code, p.name),
        features: localizePlanFeatures(tCatalog, p.features),
      }))
    : FALLBACK_PLANS_BASE.map(p => {
        const keys = FALLBACK_PLAN_KEYS[p.name];
        return { ...p, name: t(keys.name), features: keys.features.map(k => t(k)) };
      });

  const dateLocale = intlLocale(locale);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title={t('heading')}
        subtitle={t('subtext')}
        className="text-center mb-10"
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`rounded-2xl border bg-surface p-6 shadow-card ${plan.tier === 'PREMIUM' ? 'border-teal ring-2 ring-teal/20' : 'border-gold/20'}`}
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-primary">{plan.name}</h2>
              {plan.tier === 'PREMIUM' && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-teal/10 text-teal">{t('badges.mostPopular')}</span>
              )}
            </div>
            <div className="mb-6">
              <span className="text-3xl font-bold text-foreground">₹{plan.amount.toLocaleString(dateLocale)}</span>
              {plan.amount > 0 && <span className="text-sm text-muted-foreground">{t(INTERVAL_KEY[plan.interval])}</span>}
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
              {plan.amount === 0 ? t('cta.continueFree') : t('cta.choosePlan')}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        {t('footer')} <Link href="/settings/billing" className="text-teal hover:underline">{t('footerLinkLabel')}</Link>.
      </p>
    </main>
  );
}
