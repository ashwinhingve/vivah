import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';

export default function Loading() {
  return (
    <PageTransition className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-gold/10" />
        <PageHeader title="Loading..." subtitle="" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-gold/10"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl bg-gold/10"
            />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
