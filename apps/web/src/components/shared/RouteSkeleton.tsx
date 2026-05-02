import { Skeleton } from '@/components/ui/skeleton';

export function RouteSkeleton({ rows = 4, withHeader = true }: { rows?: number; withHeader?: boolean }) {
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-8" aria-busy="true">
      {withHeader ? (
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
      ) : null}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
