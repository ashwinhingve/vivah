import type { Metadata } from 'next';
import { IndianRupee } from 'lucide-react';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PricingBreakdown } from './PricingBreakdown.client';
import type { WirePricingRule, WirePricingSuggestion } from './types';

export const metadata: Metadata = { title: 'Dynamic Pricing · Vendor' };
// Reads per-user session cookie via fetchAuth → must render dynamically.
export const dynamic = 'force-dynamic';

/** A plausible default event date ~30 days out, YYYY-MM-DD. */
function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default async function VendorPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ ruleId?: string; date?: string }>;
}) {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const sp = await searchParams;
  const rulesData = await fetchAuth<{ rules: WirePricingRule[]; count: number }>(
    '/api/v1/pricing/rules',
  );
  const rules = rulesData?.rules ?? [];

  const selectedRuleId =
    sp.ruleId && rules.some((r) => r.id === sp.ruleId) ? sp.ruleId : rules[0]?.id;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : defaultDate();

  let suggestion: WirePricingSuggestion | null = null;
  if (selectedRuleId) {
    const s = await fetchAuth<{ suggestion: WirePricingSuggestion }>(
      `/api/v1/pricing/suggest?ruleId=${selectedRuleId}&date=${date}`,
    );
    suggestion = s?.suggestion ?? null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        eyebrow="Vendor"
        title="Dynamic Pricing"
        subtitle="A date-aware suggested price — always yours to override."
      />

      {rules.length === 0 || !selectedRuleId ? (
        <EmptyState
          icon={IndianRupee}
          title="No pricing rules yet"
          description="Add a pricing rule with a base price and your floor / ceiling bounds to see auspicious-date and demand-aware suggestions."
        />
      ) : (
        <PricingBreakdown
          rules={rules}
          selectedRuleId={selectedRuleId}
          date={date}
          suggestion={suggestion}
        />
      )}
    </main>
  );
}
