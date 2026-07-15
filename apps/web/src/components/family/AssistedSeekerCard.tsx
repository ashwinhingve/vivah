import { Link } from '@/i18n/navigation';
import { ArrowRight, Heart, History } from 'lucide-react';
import type { ParentLink } from '@/lib/family-mode-api';

interface Props {
  link: ParentLink;
  pendingCount: number;
  /** Resolved display name for the linked child — falls back to the relationship label when absent. */
  name?: string | null;
}

const RELATIONSHIP_LABEL: Record<ParentLink['relationship'], string> = {
  FATHER:    'Father',
  MOTHER:    'Mother',
  GUARDIAN:  'Guardian',
  SIBLING:   'Sibling',
};

const PERMISSION_LABEL: Record<ParentLink['permissions'], string> = {
  VIEW_ONLY:     'View only',
  EDIT_PROFILE:  'Can edit profile',
  DRAFT_ACTIONS: 'Can draft actions',
  FULL_PROXY:    'Full proxy',
};

/** One assisted seeker on the family hub — quick links into the co-pilot tools. */
export function AssistedSeekerCard({ link, pendingCount, name }: Props) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {name ?? RELATIONSHIP_LABEL[link.relationship]}
          </p>
          <p className="mt-0.5 text-xs text-gold-muted">
            {name ? `${RELATIONSHIP_LABEL[link.relationship]} · ` : ''}
            {PERMISSION_LABEL[link.permissions]}
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-2xs font-semibold text-warning">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/family/browse/${link.childUserId}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-teal px-3 text-sm font-medium text-white transition-colors hover:bg-teal-hover"
        >
          <Heart className="h-3.5 w-3.5" aria-hidden="true" />
          Draft an interest
        </Link>
        <Link
          href={`/family/parent-mode/${link.childUserId}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gold/30 px-3 text-sm font-medium text-primary transition-colors hover:bg-gold/10"
        >
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          View history
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
