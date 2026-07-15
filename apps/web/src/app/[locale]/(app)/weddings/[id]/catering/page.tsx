import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { CateringEstimates } from '@/components/wedding/CateringEstimates';

export const metadata = { title: 'Catering Estimates — Smart Shaadi' };

interface PageProps {
  params: Promise<{ id: string }>;
}

function EstimatesSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5 animate-pulse"
        >
          <div className="h-5 w-40 bg-muted/40 rounded mb-3" />
          <div className="h-3 w-24 bg-muted/40 rounded mb-5" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 bg-muted/40 rounded" />
            <div className="h-12 bg-muted/40 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function CateringPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
          <PageHeader
            title="Catering Estimates"
            subtitle="Predicted attendance per ceremony based on guest RSVP patterns and history."
          />

          <Suspense fallback={<EstimatesSkeleton />}>
            <CateringEstimates weddingId={id} />
          </Suspense>
        </div>
      </main>
    </PageTransition>
  );
}
