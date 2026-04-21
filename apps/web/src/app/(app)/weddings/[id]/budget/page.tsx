import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BudgetTracker } from '@/components/wedding/BudgetTracker';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingPlan, WeddingSummary } from '@smartshaadi/types';

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
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Back */}
        <Link
          href={`/weddings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Overview
        </Link>

        <h1 className="font-heading text-2xl text-[#7B2D42] mb-1">Budget</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Track spending across your wedding categories.
        </p>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-1 mb-6">
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
                  ? 'bg-[#0E7C7B]/10 text-[#0E7C7B]'
                  : 'text-muted-foreground hover:text-[#7B2D42] hover:bg-[#FEFAF6]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Could not load budget data. Please try again.</p>
          </div>
        )}

        {/* Budget Tracker */}
        {!error && plan && (
          <BudgetTracker
            total={plan.budget.total}
            currency={plan.budget.currency}
            categories={plan.budget.categories}
          />
        )}

        {/* No plan yet */}
        {!error && !plan && (
          <div className="bg-white border border-dashed border-[#C5A47E]/30 rounded-xl p-12 text-center shadow-sm">
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
