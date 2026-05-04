import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { GuestTable } from '@/components/wedding/GuestTable.client';
import { RsvpStats } from '@/components/wedding/RsvpStats';
import { SendInvitations } from '@/components/wedding/SendInvitations.client';
import { fetchAuth } from '@/lib/server-fetch';
import type { GuestRich, Ceremony } from '@smartshaadi/types';

async function fetchGuests(weddingId: string): Promise<{
  guests: GuestRich[]; error: boolean;
}> {
  const data = await fetchAuth<{ guests: GuestRich[] }>(
    `/api/v1/weddings/${weddingId}/guests`,
  );
  if (data === null) return { guests: [], error: true };
  return { guests: data.guests ?? [], error: false };
}

async function fetchCeremonies(weddingId: string): Promise<Ceremony[]> {
  const data = await fetchAuth<{ ceremonies: Ceremony[] }>(`/api/v1/weddings/${weddingId}/ceremonies`);
  return data?.ceremonies ?? [];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GuestsPage({ params }: PageProps) {
  const { id } = await params;
  const [{ guests, error }, ceremonies] = await Promise.all([
    fetchGuests(id),
    fetchCeremonies(id),
  ]);

  if (false) notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        {/* Back */}
        <Link
          href={`/weddings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Overview
        </Link>

        <h1 className="font-heading text-2xl text-primary mb-1">Guests</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Manage guest list, RSVPs, invitations, analytics, and check-in.
        </p>

        {/* Tab nav */}
        <div className="flex gap-1 bg-surface border border-gold/20 rounded-xl shadow-sm p-1 mb-6 overflow-x-auto">
          {[
            { href: `/weddings/${id}/guests`,            label: 'List',      active: true },
            { href: `/weddings/${id}/guests/analytics`,  label: 'Analytics', active: false },
            { href: `/weddings/${id}/guests/check-in`,   label: 'Check-in',  active: false },
            { href: `/weddings/${id}/rsvp-questions`,    label: 'Questions', active: false },
            { href: `/weddings/${id}/seating`,           label: 'Seating',   active: false },
          ].map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              className={`flex-1 text-center min-h-[44px] py-2.5 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-teal/10 text-teal'
                  : 'text-muted-foreground hover:text-primary hover:bg-background'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center mb-6">
            <p className="text-destructive font-medium">Could not load guests. Please try again.</p>
          </div>
        )}

        {/* RSVP stats (only if we have guests) */}
        {!error && guests.length > 0 && <RsvpStats guests={guests} />}

        {/* Send invitations */}
        {!error && guests.length > 0 && (
          <SendInvitations weddingId={id} guests={guests} />
        )}

        {/* Guest table */}
        {!error && <GuestTable weddingId={id} initialGuests={guests} ceremonies={ceremonies} />}
      </div>
    </div>
  );
}
