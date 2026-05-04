import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { RsvpQuestionsBuilder } from '@/components/wedding/RsvpQuestionsBuilder.client';
import type { RsvpCustomQuestion } from '@smartshaadi/types';

interface PageProps { params: Promise<{ id: string }>; }

export default async function RsvpQuestionsPage({ params }: PageProps) {
  const { id } = await params;
  const data = await fetchAuth<{ questions: RsvpCustomQuestion[] }>(`/api/v1/weddings/${id}/rsvp-questions`);
  const questions = data?.questions ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}/guests`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Guests
        </Link>

        <h1 className="font-heading text-2xl text-primary mb-1">Custom RSVP Questions</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Add follow-up questions guests answer when they RSVP — drink preferences, song requests, transport needs.
        </p>

        <RsvpQuestionsBuilder weddingId={id} initial={questions} />
      </div>
    </div>
  );
}
