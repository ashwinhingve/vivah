import { Skeleton } from '@/components/ui/skeleton';
import { ChartSkeleton } from '@/components/shared';

export default function Loading() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-8" aria-busy="true">
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="mb-6">
        <Skeleton className="h-8 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="space-y-8">
        {[...Array(6)].map((_, i) => (
          <div key={i}>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64 mb-4" />
            <ChartSkeleton />
          </div>
        ))}
      </div>
    </main>
  );
}
