import { Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
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
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href={`/weddings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to wedding
        </Link>

        <h1 className="font-heading text-primary text-3xl mb-2">Catering Estimates</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Predicted attendance per ceremony based on guest RSVP patterns and history.
        </p>

        <Suspense fallback={<EstimatesSkeleton />}>
          <CateringEstimates weddingId={id} />
        </Suspense>
      </div>
    </main>
  );
}
