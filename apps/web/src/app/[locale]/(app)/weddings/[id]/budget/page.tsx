import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { BudgetEditor } from '@/components/wedding/BudgetEditor.client';
import { BudgetDonut, type BudgetSlice } from '@/components/wedding/BudgetDonut';
import { BudgetLendingCard } from '@/components/wedding/BudgetLendingCard.client';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { fetchAuth } from '@/lib/server-fetch';
import { formatINR, formatINRCompact } from '@/lib/format';
import type { WeddingPlan, WeddingSummary, LoanOffer } from '@smartshaadi/types';

// Token CSS-var colors for donut slices (no raw hex)
const SLICE_COLORS = [
  'var(--color-primary)',
  'var(--color-teal)',
  'var(--color-gold)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-gold-muted)',
] as const;

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const LENDING_LIVE = process.env['NEXT_PUBLIC_LENDING_LIVE'] === 'true';

interface OffersResponse {
  isLsp: boolean;
  offers: LoanOffer[];
  mock: boolean;
}

async function fetchOffers(): Promise<OffersResponse> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(`${API_BASE}/api/v1/lending/offers?context=PLANNING`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { isLsp: true, offers: [], mock: true };
    const json = (await res.json()) as { data?: OffersResponse };
    return json.data ?? { isLsp: true, offers: [], mock: true };
  } catch {
    return { isLsp: true, offers: [], mock: true };
  }
}

async function fetchPlan(weddingId: string): Promise<{
  plan: WeddingPlan | null;
  weddingName: string | null;
  error: boolean;
  notFound: boolean;
}> {
  const detail = await fetchAuth<WeddingSummary & { plan?: WeddingPlan }>(
    `/api/v1/weddings/${weddingId}`,
  );
  if (detail === null) return { plan: null, weddingName: null, error: true, notFound: false };
  return {
    plan: detail.plan ?? null,
    weddingName: detail.weddingName ?? detail.venueName ?? null,
    error: false,
    notFound: false,
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BudgetPage({ params }: PageProps) {
  const { id } = await params;
  const { plan, weddingName, error, notFound: nf } = await fetchPlan(id);

  if (nf) notFound();

  const totalSpent = plan?.budget?.categories?.reduce((s, c) => s + (c.spent ?? 0), 0) ?? 0;
  const totalBudget = plan?.budget?.total ?? 0;
  const spentPct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  // Shortfall signal: when actual spend exceeds total budget
  const hasShortfall = totalBudget > 0 && totalSpent > totalBudget;
  const shortfallAmount = hasShortfall ? totalSpent - totalBudget : 0;

  // Fetch lending offers only if shortfall exists and lending flag is considered
  const { offers, mock } = hasShortfall ? await fetchOffers() : { offers: [], mock: true };
  const isPreview = mock || !LENDING_LIVE;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">

        <PageHeader
          title="Budget"
          subtitle={weddingName ? `${weddingName} · Budget tracker` : 'Track spending across your wedding categories.'}
          breadcrumbs={[
            { label: 'My Weddings', href: '/weddings' },
            { label: weddingName ?? 'Wedding', href: `/weddings/${id}` },
            { label: 'Budget' },
          ]}
        />

        {/* Sub-tab nav (preserved Mohit fix: ?from=budget links) */}
        <div className="flex gap-1 bg-surface border border-gold/20 rounded-xl shadow-card p-1 mb-6">
          {[
            { href: `/weddings/${id}/tasks?from=budget`,  label: 'Tasks',  active: false },
            { href: `/weddings/${id}/budget`,             label: 'Budget', active: true },
            { href: `/weddings/${id}/guests?from=budget`, label: 'Guests', active: false },
          ].map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              className={`flex-1 text-center min-h-[44px] py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-teal/10 text-teal'
                  : 'text-muted-foreground hover:text-primary hover:bg-background'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center">
            <p className="text-destructive font-medium">Could not load budget data. Please try again.</p>
          </div>
        )}

        {/* Budget Tracker */}
        {!error && plan && (
          <>
            {/* Donut + summary */}
            {plan.budget.categories.length > 0 && (
              <div className="mb-6 rounded-xl border border-gold/20 bg-surface p-5 shadow-card">
                <SectionHeader title="Spend by Category" />
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Donut — reuse pure-SVG BudgetDonut; no recharts */}
                  <div className="relative shrink-0">
                    <BudgetDonut
                      totalBudget={plan.budget.total}
                      slices={plan.budget.categories.map((c, i): BudgetSlice => ({
                        label: c.name,
                        amount: c.spent,
                        color: SLICE_COLORS[i % SLICE_COLORS.length]!,
                      }))}
                      size={180}
                    />
                    {/* Center label — Playfair burgundy */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="font-heading text-base font-bold text-primary leading-tight">
                        {formatINRCompact(totalSpent)}
                      </span>
                      <span className="text-2xs text-muted-foreground">of {formatINRCompact(totalBudget)}</span>
                    </div>
                  </div>

                  {/* Summary column */}
                  <div className="flex-1 w-full">
                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Spent</span>
                        <span className="font-semibold text-primary">{spentPct}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            spentPct > 90 ? 'bg-destructive' : spentPct > 70 ? 'bg-warning' : 'bg-teal'
                          }`}
                          style={{ width: `${spentPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-gold/20 bg-background p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Total Budget</p>
                        <p className="font-heading text-lg font-semibold text-primary">
                          {formatINR(plan.budget.total)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gold/20 bg-background p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Remaining</p>
                        <p className={`font-heading text-lg font-semibold ${
                          totalBudget - totalSpent < 0 ? 'text-destructive' : 'text-success'
                        }`}>
                          {formatINR(totalBudget - totalSpent)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Editable categories table */}
            <SectionHeader title="Category Breakdown" subtitle="Edit allocated and spent amounts inline" />
            <BudgetEditor
              weddingId={id}
              total={plan.budget.total}
              currency={plan.budget.currency}
              categories={plan.budget.categories}
            />

            {/* Lending card — shown only when there's a shortfall */}
            {hasShortfall && (
              <div className="mt-8">
                <BudgetLendingCard
                  weddingId={id}
                  shortfallAmount={shortfallAmount}
                  initialOffers={offers}
                  isPreview={isPreview}
                />
              </div>
            )}
          </>
        )}

        {/* No plan yet */}
        {!error && !plan && (
          <div className="bg-surface border border-dashed border-gold/30 rounded-xl p-12 text-center shadow-card">
            <p className="text-muted-foreground font-medium">No wedding plan found.</p>
            <p className="text-muted-foreground text-sm mt-1">
              Create a wedding plan first to track your budget.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
