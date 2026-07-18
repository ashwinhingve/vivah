import { PageTransition } from '@/components/motion/PageTransition.client';

export default function CampaignDetailLoading() {
  return (
    <PageTransition className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Back link skeleton */}
        <div className="h-4 w-32 animate-pulse rounded bg-gold/10" />

        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-gold/10" />
          <div className="h-4 w-96 animate-pulse rounded bg-gold/10" />
        </div>

        {/* Campaign info card skeleton */}
        <div className="h-20 animate-pulse rounded-2xl bg-gold/10" />

        {/* Content panel skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-40 animate-pulse rounded bg-gold/10" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-2xl bg-gold/10" />
            <div className="h-64 animate-pulse rounded-2xl bg-gold/10" />
          </div>
        </div>

        {/* Sends table skeleton */}
        <div className="space-y-2">
          <div className="h-6 w-40 animate-pulse rounded bg-gold/10" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gold/10" />
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
