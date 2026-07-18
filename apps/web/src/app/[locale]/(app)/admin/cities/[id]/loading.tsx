import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';

export default function Loading() {
  return (
    <PageTransition className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-gold/10" />
        <PageHeader title="Loading..." subtitle="" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-gold/10"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-gold/10" />
        <div className="h-48 animate-pulse rounded-2xl bg-gold/10" />
      </div>
    </PageTransition>
  );
}
