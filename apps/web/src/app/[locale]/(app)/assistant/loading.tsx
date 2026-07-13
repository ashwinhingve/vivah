import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-12rem)]" aria-busy="true">
      <header className="mb-4">
        <Skeleton className="h-6 w-28 sm:h-7 sm:w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
      </header>
      <div className="h-full border border-gold/20 rounded-xl bg-surface shadow-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden px-4 py-4 space-y-4">
          <div className="flex justify-start">
            <Skeleton className="h-10 w-2/3 max-w-xs rounded-xl" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-1/2 max-w-xs rounded-xl" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-16 w-3/4 max-w-sm rounded-xl" />
          </div>
        </div>
        <div className="border-t border-gold/20 px-4 py-3">
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </main>
  );
}
