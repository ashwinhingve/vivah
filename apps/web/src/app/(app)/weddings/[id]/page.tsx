import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, MapPin, Users, CheckSquare, ArrowLeft, Wallet } from 'lucide-react';
import type { WeddingSummary, WeddingPlan } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface WeddingDetailResponse {
  success: boolean;
  data?: WeddingSummary & { plan?: WeddingPlan };
  error?: string;
}

async function fetchWedding(id: string): Promise<WeddingDetailResponse['data'] | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/weddings/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Fetch failed');
    const json = (await res.json()) as WeddingDetailResponse;
    return json.success ? (json.data ?? null) : null;
  } catch {
    return null;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Date TBD';
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WeddingOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const wedding = await fetchWedding(id);

  if (!wedding) notFound();

  const { total, done } = wedding.taskProgress;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const tabs = [
    { href: `/weddings/${id}/tasks`,   label: 'Tasks' },
    { href: `/weddings/${id}/budget`,  label: 'Budget' },
    { href: `/weddings/${id}/guests`,  label: 'Guests' },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Back + Header */}
        <div className="mb-2">
          <Link
            href="/weddings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-4 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All Weddings
          </Link>
          <h1 className="font-heading text-2xl text-[#7B2D42]">
            {wedding.venueName ?? 'Wedding Plan'}
          </h1>
          {wedding.venueCity && (
            <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#C5A47E]" aria-hidden="true" />
              {wedding.venueCity}
            </p>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <StatCard
            icon={<Calendar className="h-5 w-5 text-[#C5A47E]" />}
            label="Wedding Date"
            value={formatDate(wedding.weddingDate)}
            small
          />
          <StatCard
            icon={<Users className="h-5 w-5 text-[#C5A47E]" />}
            label="Guests"
            value={String(wedding.guestCount)}
          />
          <StatCard
            icon={<CheckSquare className="h-5 w-5 text-[#C5A47E]" />}
            label="Tasks Done"
            value={`${done}/${total}`}
          />
          <StatCard
            icon={<Wallet className="h-5 w-5 text-[#C5A47E]" />}
            label="Budget"
            value={formatCurrency(wedding.budgetTotal)}
          />
        </div>

        {/* Task progress bar */}
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-foreground">Overall Progress</span>
            <span className="text-[#0E7C7B] font-semibold">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#F5EFE8]">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: '#0E7C7B' }}
            />
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-1 mb-6">
          {tabs.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex-1 text-center min-h-[44px] py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-[#7B2D42] hover:bg-[#FEFAF6] transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Quick-access hint */}
        <p className="text-center text-xs text-muted-foreground">
          Use the tabs above to manage tasks, budget, and guests.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  small = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`font-semibold text-foreground leading-snug ${small ? 'text-xs' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  );
}
