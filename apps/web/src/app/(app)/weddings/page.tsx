import Link from 'next/link';
import { PlusCircle, Calendar } from 'lucide-react';
import { WeddingCard } from '@/components/wedding/WeddingCard';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingSummary } from '@smartshaadi/types';

async function fetchWeddings(): Promise<{ weddings: WeddingSummary[]; error: boolean }> {
  const data = await fetchAuth<{ weddings: WeddingSummary[] }>('/api/v1/weddings');
  if (data === null) return { weddings: [], error: true };
  return { weddings: data.weddings ?? [], error: false };
}

export default async function WeddingsPage() {
  const { weddings, error } = await fetchWeddings();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading text-primary">My Wedding</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Plan, track, and celebrate your perfect day.
            </p>
          </div>
          <Link
            href="/weddings/new"
            className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors bg-teal"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            New Wedding
          </Link>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center">
            <p className="text-destructive font-medium">Could not load your weddings. Please try again.</p>
          </div>
        )}

        {/* Empty state */}
        {!error && weddings.length === 0 && (
          <div className="bg-surface border border-gold/20 rounded-xl p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background">
              <Calendar className="h-8 w-8 text-gold" />
            </div>
            <h2 className="font-heading text-lg text-primary mb-1">No weddings yet</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Start planning your perfect day — create your first wedding event.
            </p>
            <Link
              href="/weddings/new"
              className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors bg-teal"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Plan Your Wedding
            </Link>
          </div>
        )}

        {/* Wedding list */}
        {!error && weddings.length > 0 && (
          <div className="grid gap-4">
            {weddings.map((w) => (
              <WeddingCard key={w.id} wedding={w} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
