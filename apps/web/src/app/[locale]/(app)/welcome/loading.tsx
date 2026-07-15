import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen bg-background" aria-busy="true">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <header className="flex flex-col items-center text-center">
          <Skeleton className="h-8 w-64 sm:h-9 sm:w-80" />
          <Skeleton className="mt-3 h-4 w-72" />
        </header>

        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <div className="flex h-full flex-col items-start gap-3 rounded-2xl border border-gold/25 bg-surface p-5 shadow-card">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Skeleton className="h-11 w-52 rounded-lg" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>
    </main>
  );
}
