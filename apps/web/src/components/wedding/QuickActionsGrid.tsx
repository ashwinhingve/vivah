import { Link } from '@/i18n/navigation';
import { Plus, UserPlus, Wallet, Receipt, Store, ListChecks, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'teal' | 'gold' | 'success' | 'warning';

const TONE: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  teal: 'bg-teal/10 text-teal',
  gold: 'bg-gold/15 text-gold-muted',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
};

const ACTIONS: { seg: string; label: string; desc: string; Icon: LucideIcon; tone: Tone }[] = [
  { seg: 'ceremonies', label: 'Add ceremony', desc: 'Plan a new event', Icon: Plus, tone: 'primary' },
  { seg: 'guests', label: 'Invite guests', desc: 'Build your guest list', Icon: UserPlus, tone: 'teal' },
  { seg: 'budget', label: 'Manage budget', desc: 'Allocate by category', Icon: Wallet, tone: 'gold' },
  { seg: 'expenses', label: 'Add expense', desc: 'Log a payment', Icon: Receipt, tone: 'success' },
  { seg: 'vendors', label: 'Find vendors', desc: 'Book trusted pros', Icon: Store, tone: 'warning' },
  { seg: 'tasks', label: 'Create tasks', desc: 'Track what’s left', Icon: ListChecks, tone: 'primary' },
];

/** Primary planning actions, surfaced as prominent tiles. */
export function QuickActionsGrid({ id }: { id: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {ACTIONS.map((a) => (
        <Link
          key={a.seg + a.label}
          href={`/weddings/${id}/${a.seg}`}
          className="group flex min-h-[44px] items-center gap-3 rounded-xl border border-gold/20 bg-surface p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', TONE[a.tone])}
          >
            <a.Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
              {a.label}
              <ArrowRight
                className="h-3 w-3 -translate-x-1 text-teal opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden="true"
              />
            </span>
            <span className="block truncate text-xs text-muted-foreground">{a.desc}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
