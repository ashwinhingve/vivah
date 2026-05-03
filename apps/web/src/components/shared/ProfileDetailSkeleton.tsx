import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function ProfileDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)} aria-busy="true" aria-label="Loading profile">
      {/* hero */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <Skeleton className="aspect-[16/9] w-full rounded-none" />
        <div className="space-y-3 p-5">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </div>
      {/* tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      {/* content */}
      <div className="space-y-3 rounded-xl border border-border bg-surface p-5 shadow-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="col-span-2 h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
