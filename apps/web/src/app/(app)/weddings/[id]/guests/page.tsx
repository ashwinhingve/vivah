import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { GuestTable } from '@/components/wedding/GuestTable.client';
import { RsvpStats } from '@/components/wedding/RsvpStats';
import type { GuestSummary } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface GuestsApiResponse {
  success: boolean;
  data?: GuestSummary[];
  error?: string;
}

async function fetchGuests(weddingId: string): Promise<{
  guests: GuestSummary[];
  error: boolean;
  notFound: boolean;
}> {
  try {
    const res = await fetch(`${API_URL}/api/v1/weddings/${weddingId}/guests`, {
      cache: 'no-store',
    });
    if (res.status === 404) return { guests: [], error: false, notFound: true };
    if (!res.ok) return { guests: [], error: true, notFound: false };
    const json = (await res.json()) as GuestsApiResponse;
    return {
      guests:   json.success ? (json.data ?? []) : [],
      error:    !json.success,
      notFound: false,
    };
  } catch {
    return { guests: [], error: true, notFound: false };
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GuestsPage({ params }: PageProps) {
  const { id } = await params;
  const { guests, error, notFound: nf } = await fetchGuests(id);

  if (nf) notFound();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        {/* Back */}
        <Link
          href={`/weddings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Overview
        </Link>

        <h1 className="font-heading text-2xl text-[#7B2D42] mb-1">Guests</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Manage your guest list, RSVPs, and send invitations.
        </p>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-1 mb-6">
          {[
            { href: `/weddings/${id}/tasks`,  label: 'Tasks',  active: false },
            { href: `/weddings/${id}/budget`, label: 'Budget', active: false },
            { href: `/weddings/${id}/guests`, label: 'Guests', active: true },
          ].map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              className={`flex-1 text-center min-h-[44px] py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#0E7C7B]/10 text-[#0E7C7B]'
                  : 'text-muted-foreground hover:text-[#7B2D42] hover:bg-[#FEFAF6]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-6">
            <p className="text-red-700 font-medium">Could not load guests. Please try again.</p>
          </div>
        )}

        {/* RSVP stats (only if we have guests) */}
        {!error && guests.length > 0 && <RsvpStats guests={guests} />}

        {/* Guest table */}
        {!error && <GuestTable weddingId={id} initialGuests={guests} />}
      </div>
    </div>
  );
}
