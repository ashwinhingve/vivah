import { Suspense } from 'react';
import { CompatibilityDisclaimer } from '@/components/dpi/CompatibilityDisclaimer';
import { CompatibilityGauge } from '@/components/dpi/CompatibilityGauge.client';

export const metadata = { title: 'Compatibility Analysis — Smart Shaadi' };

interface PageProps {
  params: Promise<{ id: string }>;
}

function GaugeSkeleton() {
  return (
    <div className="text-center" aria-busy="true">
      <div className="mx-auto h-[140px] w-full max-w-[280px] rounded-t-full bg-muted/40 animate-pulse" />
      <p className="mt-4 text-sm text-muted-foreground">Analysing compatibility patterns…</p>
    </div>
  );
}

export default async function CompatibilityPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <CompatibilityDisclaimer />

        <h1 className="font-heading text-primary text-2xl mb-2">
          Compatibility Analysis
        </h1>

        <p className="text-muted-foreground text-sm mb-6">
          A thoughtful look at your match based on profile patterns.
        </p>

        <Suspense fallback={<GaugeSkeleton />}>
          <CompatibilityGauge matchId={id} />
        </Suspense>
      </div>
    </main>
  );
}
