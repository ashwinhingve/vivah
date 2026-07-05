import { Link } from '@/i18n/navigation';
import { Check, Circle, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReadinessMilestone {
  key: string;
  label: string;
  done: boolean;
  /** Sub-path under /weddings/[id] this milestone links to. */
  seg: string;
}

interface Props {
  id: string;
  pct: number;
  milestones: ReadinessMilestone[];
}

/**
 * Planning-readiness summary: progress bar + per-essential pill chips (each a
 * link to its section) + the single most useful next step.
 */
export function WeddingReadinessCard({ id, pct, milestones }: Props) {
  const done = milestones.filter((m) => m.done).length;
  const total = milestones.length;
  const next = milestones.find((m) => !m.done);
  const href = (seg: string) => `/weddings/${id}${seg ? `/${seg}` : ''}`;

  return (
    <div className="rounded-2xl border border-gold/25 bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-primary">Planning readiness</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {done} of {total} essentials set up
          </p>
        </div>
        <span className="font-heading text-3xl font-bold leading-none text-primary">
          {pct}
          <span className="text-base font-semibold">%</span>
        </span>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gold/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal to-teal-hover transition-all duration-700 ease-out"
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {milestones.map((m) => (
          <Link
            key={m.key}
            href={href(m.seg)}
            aria-label={m.done ? `${m.label} — done` : `${m.label} — not set up yet`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:-translate-y-0.5',
              m.done
                ? 'border-success/30 bg-success/10 text-success hover:border-success/60'
                : 'border-gold/30 bg-gold/5 text-gold-muted hover:border-gold/60',
            )}
          >
            {m.done ? (
              <Check className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Circle className="h-3 w-3" aria-hidden="true" />
            )}
            {m.label}
          </Link>
        ))}
      </div>

      {next ? (
        <Link
          href={href(next.seg)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Next: set up {next.label.toLowerCase()}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : (
        <p className="mt-4 text-sm font-semibold text-success" aria-live="polite">
          Everything essential is in place 🎉
        </p>
      )}
    </div>
  );
}
