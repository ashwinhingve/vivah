import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from './TableSkeleton';

interface AdminTableSkeletonProps {
  rows?: number;
  cols?: number;
  /** Filter pills / status tabs row above the table. */
  withFilters?: boolean;
}

/** Full-page loading state for admin table routes: heading, filter row, table. */
export function AdminTableSkeleton({ rows = 8, cols = 4, withFilters = true }: AdminTableSkeletonProps) {
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-8" aria-busy="true">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      {withFilters ? (
        <div className="mb-4 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      ) : null}
      <TableSkeleton rows={rows} cols={cols} />
    </main>
  );
}
