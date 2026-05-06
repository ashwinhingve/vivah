import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BudgetTracker } from '@/components/wedding/BudgetTracker';
import { BudgetDonut, type BudgetSlice } from '@/components/wedding/BudgetDonut';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingPlan, WeddingSummary } from '@smartshaadi/types';

const SLICE_COLORS = [
  'var(--primary)',
  'var(--teal)',
  'var(--gold)',
  'var(--success)',
  'var(--warning)',
  'var(--gold-muted)',
] as const;

async function fetchPlan(weddingId: string): Promise<{
  plan: WeddingPlan | null;
  error: boolean;
  notFound: boolean;
}> {
  // Plan is embedded in GET /weddings/:id — no dedicated /plan endpoint.
  const detail = await fetchAuth<WeddingSummary & { plan?: WeddingPlan }>(
    `/api/v1/weddings/${weddingId}`,
  );
  if (detail === null) return { plan: null, error: true, notFound: false };
  return { plan: detail.plan ?? null, error: false, notFound: false };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BudgetPage({ params }: PageProps) {
  const { id } = await params;
  const { plan, error, notFound: nf } = await fetchPlan(id);

  if (nf) notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Back */}
        <Link
          href={`/weddings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Overview
        </Link>

        <h1 className="font-heading text-2xl text-primary mb-1">Budget</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Track spending across your wedding categories.
        </p>

        {/* Tab nav */}
        <div className="flex gap-1 bg-surface border border-gold/20 rounded-xl shadow-sm p-1 mb-6">
          {[
            { href: `/weddings/${id}/tasks`,  label: 'Tasks',  active: false },
            { href: `/weddings/${id}/budget`, label: 'Budget', active: true },
            { href: `/weddings/${id}/guests`, label: 'Guests', active: false },
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
            {plan.budget.categories.length > 0 && (
              <div className="mb-6 rounded-xl border border-gold/20 bg-surface p-5 shadow-sm">
                <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
                  Spend by category
                </h2>
                <BudgetDonut
                  totalBudget={plan.budget.total}
                  slices={plan.budget.categories.map((c, i): BudgetSlice => ({
                    label: c.name,
                    amount: c.spent,
                    color: SLICE_COLORS[i % SLICE_COLORS.length]!,
                  }))}
                />
              </div>
            )}
            <BudgetTracker
              total={plan.budget.total}
              currency={plan.budget.currency}
              categories={plan.budget.categories}
            />
          </>
        )}

        {/* No plan yet */}
        {!error && !plan && (
          <div className="bg-surface border border-dashed border-gold/30 rounded-xl p-12 text-center shadow-sm">
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
