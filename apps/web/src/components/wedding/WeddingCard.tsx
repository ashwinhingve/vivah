import Link from 'next/link';
import { Calendar, MapPin, Users, CheckSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatINRCompact, formatDateIN, daysUntil } from '@/lib/format';
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
  PLANNING:  'bg-warning/15 text-warning border-warning/30',
  CONFIRMED: 'bg-teal/10 text-teal border-teal/30',
  COMPLETED: 'bg-success/15 text-success border-success/30',
  CANCELLED: 'bg-muted text-muted-foreground border-muted-foreground/20',
};

export function WeddingCard({ wedding }: WeddingCardProps) {
  const { total, done } = wedding.taskProgress;
  const taskPct = total > 0 ? Math.round((done / total) * 100) : 0;

  // WeddingSummary only exposes budgetTotal (not spent); show as chip only
  const budgetTotal = wedding.budgetTotal;

  const days = daysUntil(wedding.weddingDate);
  const isFuture = days !== null && days > 0;

  // FIX: Use weddingName as primary title (was incorrectly using venueName)
  const title = wedding.weddingName ?? wedding.venueName ?? 'Wedding Plan';

  return (
    <Link href={`/weddings/${wedding.id}`} className="block group">
      <div className="bg-surface border border-gold/20 rounded-xl shadow-card p-5 hover:shadow-card-hover hover:border-gold/40 hover:-translate-y-0.5 transition-all duration-200">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg text-primary leading-snug group-hover:text-primary-hover transition-colors truncate">
              {title}
            </h2>
            {wedding.venueName && wedding.weddingName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{wedding.venueName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isFuture && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gold/15 text-primary border border-gold/30">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {days}d
              </span>
            )}
            <span
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full border',
                STATUS_COLORS[wedding.status] ?? 'bg-secondary text-foreground border-transparent'
              )}
            >
              {STATUS_LABELS[wedding.status] ?? wedding.status}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
            <span className="truncate">{formatDateIN(wedding.weddingDate)}</span>
          </div>
          {wedding.venueCity && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
              <span className="truncate">{wedding.venueCity}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
            {wedding.guestCount} guests
          </div>
          {budgetTotal != null && (
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-gold font-bold">₹</span>
              {formatINRCompact(budgetTotal)}
            </div>
          )}
        </div>

        {/* Task progress */}
        {total > 0 && (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Planning progress</span>
              <span className="font-semibold text-primary">{taskPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gold/15">
              <div
                className="h-full rounded-full bg-teal transition-all duration-200"
                style={{ width: `${taskPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-gold/10 pt-3 mt-3">
          <span className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3" aria-hidden="true" />
            {done}/{total} tasks
          </span>
          {wedding.guestCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {wedding.guestCount} guests
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
