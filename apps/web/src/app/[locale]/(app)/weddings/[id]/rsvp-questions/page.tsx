import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { RsvpQuestionsBuilder } from '@/components/wedding/RsvpQuestionsBuilder.client';
import type { RsvpCustomQuestion } from '@smartshaadi/types';

interface PageProps { params: Promise<{ id: string }>; }

export default async function RsvpQuestionsPage({ params }: PageProps) {
  const { id } = await params;
  const data = await fetchAuth<{ questions: RsvpCustomQuestion[] }>(`/api/v1/weddings/${id}/rsvp-questions`);
  const questions = data?.questions ?? [];

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
          <Link href={`/weddings/${id}/guests`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 min-h-[44px]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Guests
          </Link>

          <PageHeader
            title="Custom RSVP Questions"
            description="Add follow-up questions guests answer when they RSVP — drink preferences, song requests, transport needs."
          />

          <RsvpQuestionsBuilder weddingId={id} initial={questions} />
        </div>
      </main>
    </PageTransition>
  );
}
