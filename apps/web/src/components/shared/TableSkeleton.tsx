import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, cols = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-surface', className)} aria-busy="true" aria-label="Loading rows">
      {/* header */}
      <div
        className="hidden border-b border-border bg-secondary/40 px-3 py-3 md:grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 w-3/4" />
        ))}
      </div>
      {/* rows */}
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <li
            key={r}
            className="grid grid-cols-1 gap-2 px-3 py-3 md:gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } as React.CSSProperties}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-full" />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
