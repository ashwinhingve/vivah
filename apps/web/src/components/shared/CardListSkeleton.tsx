import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CardListSkeletonProps {
  count?: number;
  columns?: 1 | 2 | 3;
  className?: string;
}

const colClass: Record<NonNullable<CardListSkeletonProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

export function CardListSkeleton({ count = 6, columns = 3, className }: CardListSkeletonProps) {
  return (
    <div className={cn('grid gap-4 sm:gap-6', colClass[columns], className)} aria-busy="true" aria-label="Loading items">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
