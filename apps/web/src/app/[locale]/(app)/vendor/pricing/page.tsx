import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { IndianRupee } from 'lucide-react';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor } from '@/lib/vendor-onboarding-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { PricingBreakdown } from './PricingBreakdown.client';
import type { WirePricingRule, WirePricingSuggestion } from './types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'vendorPricing.metadata' });
  return { title: t('title') };
}

// Reads per-user session cookie via fetchAuth → must render dynamically.
export const dynamic = 'force-dynamic';

/** A plausible default event date ~30 days out, YYYY-MM-DD. */
function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default async function VendorPricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ruleId?: string; date?: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'vendorPricing' });

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
    <PageTransition>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('heading')}
          subtitle={t('subtitle')}
        />

        {rules.length === 0 || !selectedRuleId ? (
          <EmptyState
            icon={IndianRupee}
            title={t('noRules.title')}
            description={t('noRules.description')}
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
    </PageTransition>
  );
}
