import { headers } from 'next/headers';

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

const FALLBACK_PLANS: Plan[] = [
  { id: 'fallback-free',     code: 'FREE',           name: 'Free',           tier: 'STANDARD' as const, interval: 'MONTHLY' as const,  amount: 0,    features: ['Browse profiles', '5 daily likes', 'Basic filters'] },
  { id: 'fallback-standard', code: 'STANDARD_M',     name: 'Standard',       tier: 'STANDARD' as const, interval: 'MONTHLY' as const,  amount: 999,  features: ['Unlimited likes', 'See who liked you', 'Advanced filters', 'Priority support'] },
  { id: 'fallback-premium',  code: 'PREMIUM_M',      name: 'Premium',        tier: 'PREMIUM' as const,  interval: 'MONTHLY' as const,  amount: 1999, features: ['Everything in Standard', 'Verified badge', 'AI-curated matches', 'Read receipts', 'Incognito browsing'] },
  { id: 'fallback-premium-y', code: 'PREMIUM_Y',     name: 'Premium Annual', tier: 'PREMIUM' as const,  interval: 'YEARLY' as const,   amount: 19990,features: ['All Premium features', '2 months free', 'Concierge matchmaker', 'Personal brand photoshoot voucher'] },
];

const INTERVAL_LABELS: Record<Plan['interval'], string> = {
  MONTHLY:   '/month',
  QUARTERLY: '/quarter',
  YEARLY:    '/year',
};

export default async function PricingPage() {
  const fetched = await fetchPlans();
  const plans = fetched.length > 0 ? fetched : FALLBACK_PLANS;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-[#0A1F4D]">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">Find your match. Plan your wedding. All in one place.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`rounded-xl border bg-surface p-6 shadow-sm ${plan.tier === 'PREMIUM' ? 'border-[#1848C8] ring-2 ring-[#1848C8]/20' : 'border-border'}`}
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#0A1F4D]">{plan.name}</h2>
              {plan.tier === 'PREMIUM' && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-[#1848C8]/10 text-[#1848C8]">Most popular</span>
              )}
            </div>
            <div className="mb-6">
              <span className="text-3xl font-bold text-foreground">₹{plan.amount.toLocaleString('en-IN')}</span>
              {plan.amount > 0 && <span className="text-sm text-muted-foreground">{INTERVAL_LABELS[plan.interval]}</span>}
            </div>
            <ul className="mb-6 space-y-2 text-sm text-foreground">
              {(Array.isArray(plan.features) ? plan.features as string[] : []).map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <a
              href={plan.amount === 0 ? '/dashboard' : `/settings/billing?plan=${plan.code}`}
              className={`block w-full text-center min-h-[44px] py-2.5 rounded-lg font-medium transition-colors ${
                plan.tier === 'PREMIUM'
                  ? 'bg-[#0A1F4D] text-white hover:bg-[#1848C8]'
                  : 'border border-[#0A1F4D] text-[#0A1F4D] hover:bg-[#0A1F4D]/5'
              }`}
            >
              {plan.amount === 0 ? 'Continue free' : 'Choose plan'}
            </a>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        All plans renew automatically. Cancel anytime from <a href="/settings/billing" className="text-[#1848C8] hover:underline">Billing</a>.
      </p>
    </main>
  );
}
