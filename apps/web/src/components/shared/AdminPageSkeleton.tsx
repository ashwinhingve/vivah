import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from './TableSkeleton';

interface AdminPageSkeletonProps {
  /** Stat-card grid under the heading (hub / analytics layouts). */
  withStatCards?: boolean;
  withFilters?: boolean;
  rows?: number;
}

/** Full-page loading state for admin hub-style routes: heading, stat cards, table. */
export function AdminPageSkeleton({ withStatCards = true, withFilters = false, rows = 5 }: AdminPageSkeletonProps) {
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-8" aria-busy="true">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      {withStatCards ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : null}
      {withFilters ? (
        <div className="mb-4 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      ) : null}
      <TableSkeleton rows={rows} cols={3} />
    </main>
  );
}
