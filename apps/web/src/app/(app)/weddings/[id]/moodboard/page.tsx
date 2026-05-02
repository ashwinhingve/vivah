import Link from 'next/link';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { fetchMoodboard } from '@/lib/wedding-api';
import { MoodBoardClient } from '@/components/wedding/MoodBoardClient.client';
import { addMoodBoardItemAction, deleteMoodBoardItemAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

export default async function MoodBoardPage({ params }: PageProps) {
  const { id } = await params;
  const res = await fetchMoodboard(id);
  const items = res?.items ?? [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-4 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2 mb-6">
          <ImageIcon className="h-6 w-6 text-[#C5A47E]" />
          <h1 className="font-heading text-2xl text-[#7B2D42]">Mood Board</h1>
        </div>
        <MoodBoardClient
          weddingId={id}
          initialItems={items}
          addAction={addMoodBoardItemAction}
          deleteAction={deleteMoodBoardItemAction}
        />
      </div>
    </div>
  );
}
