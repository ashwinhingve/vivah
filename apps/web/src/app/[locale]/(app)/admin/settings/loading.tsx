import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-8" aria-busy="true">
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="mb-6">
        <Skeleton className="h-8 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </main>
  );
}
