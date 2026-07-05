import { Image as ImageIcon } from 'lucide-react';
import { fetchMoodboard } from '@/lib/wedding-api';
import { MoodBoardClient } from '@/components/wedding/MoodBoardClient.client';
import { addMoodBoardItemAction, deleteMoodBoardItemAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

export default async function MoodBoardPage({ params }: PageProps) {
  const { id } = await params;
  const res = await fetchMoodboard(id);
  const items = res?.items ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        <div className="flex items-center gap-2 mb-6">
          <ImageIcon className="h-6 w-6 text-gold" />
          <h1 className="font-heading text-2xl text-primary">Mood Board</h1>
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
