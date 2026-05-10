import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
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

async function fetchPlan(code: string): Promise<Plan | null> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  try {
    const h = await headers();
    const cookie = h.get('cookie') ?? '';
    const res = await fetch(`${apiBase}/api/v1/payments/subscriptions/plans`, {
      cache:   'no-store',
      headers: { cookie },
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: Plan[] };
    return (json.data ?? []).find((p) => p.code === code) ?? null;
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planCode } = await searchParams;
  if (!planCode) notFound();

  const plan = await fetchPlan(planCode);
  if (!plan) notFound();

  const features = Array.isArray(plan.features)
    ? plan.features.filter((f): f is string => typeof f === 'string')
    : [];

  const isMock = process.env['USE_MOCK_SERVICES'] === 'true';

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-center text-3xl font-bold text-primary">Complete your subscription</h1>
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Review your plan and confirm to activate.
      </p>
      <BillingConfirm
        planCode={plan.code}
        planName={plan.name}
        amount={plan.amount}
        interval={INTERVAL_LABELS[plan.interval] ?? plan.interval}
        features={features}
        isMock={isMock}
      />
    </main>
  );
}
