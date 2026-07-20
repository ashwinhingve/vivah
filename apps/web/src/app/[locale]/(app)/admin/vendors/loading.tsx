import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="mb-6">
        <Skeleton className="h-8 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-lg flex-shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
