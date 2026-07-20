import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Card-shaped placeholder for a chart: legend chips over an aspect-video block. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6', className)}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="mb-4 flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      <Skeleton className="aspect-video w-full rounded-lg" />
    </div>
  );
}
