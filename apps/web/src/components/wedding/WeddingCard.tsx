import Link from 'next/link';
import { Calendar, MapPin, Users, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeddingSummary } from '@smartshaadi/types';

interface WeddingCardProps {
  wedding: WeddingSummary;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNING:  'Planning',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING:  'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-[#0E7C7B]/10 text-[#0E7C7B]',
  CANCELLED: 'bg-red-100 text-red-700',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Date TBD';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCurrency(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function WeddingCard({ wedding }: WeddingCardProps) {
  const { total, done } = wedding.taskProgress;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link href={`/weddings/${wedding.id}`}>
      <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-5 hover:shadow-md hover:border-[#C5A47E]/40 transition-all">
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-heading text-lg text-[#7B2D42] leading-snug">
            {wedding.venueName ?? 'Wedding'}
          </h2>
          <span
            className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full',
              STATUS_COLORS[wedding.status] ?? 'bg-gray-100 text-gray-700'
            )}
          >
            {STATUS_LABELS[wedding.status] ?? wedding.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#C5A47E]" aria-hidden="true" />
            {formatDate(wedding.weddingDate)}
          </div>
          {wedding.venueCity && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#C5A47E]" aria-hidden="true" />
              {wedding.venueCity}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#C5A47E]" aria-hidden="true" />
            {wedding.guestCount} guests
          </div>
          {wedding.budgetTotal != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#C5A47E] text-xs font-bold">₹</span>
              {formatCurrency(wedding.budgetTotal)}
            </div>
          )}
        </div>

        {/* Task progress */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" aria-hidden="true" />
              Tasks
            </span>
            <span>{done}/{total} done</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#F5EFE8]">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: '#0E7C7B' }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
