/**
 * ReputationCard — presentational admin Reputation Score panel (server-safe).
 * Consumes the AI-derived trust score from GET /api/v1/admin/users/:id/reputation
 * (apps/api/src/admin/reputation.router.ts). Renders defensively: the endpoint
 * can 503 (AI service down) or 429 (rate-limited) — fetchAuth collapses both
 * (and any other failure) to `null` — so this card must never crash the
 * surrounding Server Component on a missing/bad shape.
 */
import { ShieldQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';

export type ReputationTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'flagged';

export interface ReputationFactorContribution {
  factor: string;
  contribution: number;
  direction: 'protective' | 'concern' | 'neutral';
}

export interface ReputationData {
  user_id: string;
  reputation_score: number;
  tier: ReputationTier;
  ghost_count: number;
  primary_strength: string;
  primary_concern: string | null;
  feature_contributions: ReputationFactorContribution[];
  disclaimer: string;
  cached?: boolean;
}

const TIER_LABELS: Record<ReputationTier, string> = {
  platinum: 'Highly Trusted',
  gold: 'Trusted',
  silver: 'Steady',
  bronze: 'Watch',
  flagged: 'At Risk',
};

const TIER_STYLES: Record<ReputationTier, string> = {
  platinum: 'bg-gold/15 text-gold-muted border-gold/40',
  gold: 'bg-gold/10 text-gold-muted border-gold/30',
  silver: 'bg-teal/10 text-teal border-teal/20',
  bronze: 'bg-warning/10 text-warning border-warning/30',
  flagged: 'bg-destructive/10 text-destructive border-destructive/30',
};

const DIRECTION_STYLES: Record<ReputationFactorContribution['direction'], string> = {
  protective: 'bg-success',
  concern: 'bg-destructive',
  neutral: 'bg-gold-muted',
};

interface Props {
  data: ReputationData | null;
}

export function ReputationCard({ data }: Props) {
  if (!data) {
    return (
      <section className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
        <h3 className="font-heading text-base font-semibold text-primary">Reputation Score</h3>
        <EmptyState
          className="mt-2"
          icon={ShieldQuestion}
          title="Reputation unavailable"
          description="The AI service may be rate-limited or offline right now. Try refreshing in a few minutes."
        />
      </section>
    );
  }

  const maxContribution = Math.max(1, ...data.feature_contributions.map((f) => Math.abs(f.contribution)));

  return (
    <section className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-primary">Reputation Score</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Platform trust indicator — behaviour signals over the last 30 days.
          </p>
        </div>
        {data.cached ? (
          <span className="shrink-0 rounded-full border border-gold/30 bg-background px-2 py-0.5 text-2xs font-medium text-muted-foreground">
            Cached
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <p className="font-heading text-4xl font-bold text-primary">
          {data.reputation_score}
          <span className="text-base font-normal text-muted-foreground">/100</span>
        </p>
        <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', TIER_STYLES[data.tier])}>
          {TIER_LABELS[data.tier]}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Primary strength</dt>
        <dd className="text-foreground">{data.primary_strength}</dd>
        <dt className="text-muted-foreground">Primary concern</dt>
        <dd className="text-foreground">{data.primary_concern ?? 'None flagged'}</dd>
        <dt className="text-muted-foreground">Ghost count (30d)</dt>
        <dd className="text-foreground">{data.ghost_count}</dd>
      </dl>

      {data.feature_contributions.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-muted">Factor breakdown</p>
          {data.feature_contributions.map((f) => (
            <div key={f.factor} className="flex items-center gap-2 text-xs">
              <span className="w-40 shrink-0 truncate text-muted-foreground">{f.factor}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
                <span
                  className={cn('block h-full rounded-full', DIRECTION_STYLES[f.direction])}
                  style={{ width: `${Math.min(100, (Math.abs(f.contribution) / maxContribution) * 100)}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="border-t border-gold/20 pt-3 text-2xs leading-relaxed text-muted-foreground">
        {data.disclaimer}
      </p>
    </section>
  );
}
