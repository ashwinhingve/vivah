import Link from 'next/link';
import { PlusCircle, Calendar } from 'lucide-react';
import { WeddingCard } from '@/components/wedding/WeddingCard';
import type { WeddingSummary } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface WeddingsApiResponse {
  success: boolean;
  data: WeddingSummary[];
  error?: string;
}

async function fetchWeddings(): Promise<{ weddings: WeddingSummary[]; error: boolean }> {
  try {
    const res = await fetch(`${API_URL}/api/v1/weddings`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { weddings: [], error: true };
    const json = (await res.json()) as WeddingsApiResponse;
    return {
      weddings: json.success ? (json.data ?? []) : [],
      error: !json.success,
    };
  } catch {
    return { weddings: [], error: true };
  }
}

export default async function WeddingsPage() {
  const { weddings, error } = await fetchWeddings();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading text-[#7B2D42]">My Wedding</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Plan, track, and celebrate your perfect day.
            </p>
          </div>
          <Link
            href="/weddings/new"
            className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: '#0E7C7B' }}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            New Wedding
          </Link>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Could not load your weddings. Please try again.</p>
          </div>
        )}

        {/* Empty state */}
        {!error && weddings.length === 0 && (
          <div className="bg-white border border-[#C5A47E]/20 rounded-xl p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FEFAF6]">
              <Calendar className="h-8 w-8 text-[#C5A47E]" />
            </div>
            <h2 className="font-heading text-lg text-[#7B2D42] mb-1">No weddings yet</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Start planning your perfect day — create your first wedding event.
            </p>
            <Link
              href="/weddings/new"
              className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: '#0E7C7B' }}
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
