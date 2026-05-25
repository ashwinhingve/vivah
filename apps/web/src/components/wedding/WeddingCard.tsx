import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Calendar, MapPin, Users, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatINRCompact, formatDateIN, daysUntil } from '@/lib/format';
import type { WeddingSummary } from '@smartshaadi/types';

interface WeddingCardProps {
  wedding: WeddingSummary;
}

type UrgencyKey = 'completed' | 'cancelled' | 'today' | 'tomorrow' | 'daysLeft' | 'planning';

function computeUrgencyKey(status: string, days: number | null): { key: UrgencyKey; days?: number; className: string; pulse?: boolean } {
  if (status === 'COMPLETED') {
    return { key: 'completed', className: 'bg-muted/60 text-muted-foreground border-muted-foreground/15' };
  }
  if (status === 'CANCELLED') {
    return { key: 'cancelled', className: 'bg-muted text-muted-foreground border-muted-foreground/20' };
  }
  if (days === 0) {
    return { key: 'today', className: 'bg-primary text-white border-primary shadow-sm', pulse: true };
  }
  if (days === 1) {
    return { key: 'tomorrow', className: 'bg-primary text-white border-primary shadow-sm' };
  }
  if (days != null && days > 1 && days <= 30) {
    return { key: 'daysLeft', days, className: 'bg-primary/10 text-primary border-primary/30' };
  }
  return { key: 'planning', className: 'bg-gold/15 text-primary border-gold/30' };
}

export async function WeddingCard({ wedding }: WeddingCardProps) {
  const t = await getTranslations('weddings.card');
  const { total, done } = wedding.taskProgress;
  const taskPct = total > 0 ? Math.round((done / total) * 100) : 0;

  // WeddingSummary only exposes budgetTotal (not spent); show as chip only
  const budgetTotal = wedding.budgetTotal;

  const days = daysUntil(wedding.weddingDate);
  const urgency = computeUrgencyKey(wedding.status, days);
  const urgencyLabel = urgency.key === 'daysLeft'
    ? t('statuses.daysLeft', { days: urgency.days ?? 0 })
    : t(`statuses.${urgency.key}` as 'statuses.planning');
  const cancelled = wedding.status === 'CANCELLED';

  // FIX: Use weddingName as primary title (was incorrectly using venueName)
  const title = wedding.weddingName ?? wedding.venueName ?? t('fallbackTitle');

  return (
    <Link href={`/weddings/${wedding.id}`} className="block group">
      <div className="bg-surface border border-gold/20 rounded-xl shadow-card p-5 hover:shadow-card-hover hover:border-gold/40 hover:-translate-y-0.5 transition-all duration-200">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                'font-heading text-lg text-primary leading-snug group-hover:text-primary-hover transition-colors truncate',
                cancelled && 'line-through text-muted-foreground'
              )}
            >
              {title}
            </h2>
            {wedding.venueName && wedding.weddingName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{wedding.venueName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                'inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap',
                urgency.className,
                urgency.pulse && 'animate-pulse'
              )}
            >
              {urgencyLabel}
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
            {t('guestsCount', { count: wedding.guestCount })}
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
              <span>{t('planningProgress')}</span>
              <span className="font-semibold text-primary">{taskPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gold/10">
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
            {t('tasksProgress', { done, total })}
          </span>
          {wedding.guestCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {t('guestsCount', { count: wedding.guestCount })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
