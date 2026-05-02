'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { R2Uploader } from './R2Uploader.client';
import type { MoodBoardItem, MoodBoardCategory } from '@smartshaadi/types';

interface Props {
  weddingId: string;
  initialItems: MoodBoardItem[];
  addAction: (weddingId: string, data: { r2Key: string; caption?: string; category?: string }) => Promise<void>;
  deleteAction: (weddingId: string, itemId: string) => Promise<void>;
}

const CATEGORIES: MoodBoardCategory[] = ['DECOR', 'ATTIRE', 'MAKEUP', 'VENUE', 'FLORAL', 'INVITATION', 'CAKE', 'OTHER'];

export function MoodBoardClient({ weddingId, initialItems, addAction, deleteAction }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<MoodBoardCategory | 'ALL'>('ALL');
  const [category, setCategory] = useState<MoodBoardCategory>('DECOR');
  const [caption, setCaption] = useState('');
  const [, startTransition] = useTransition();

  async function handleUploaded(r2Key: string) {
    await addAction(weddingId, { r2Key, caption: caption || undefined, category });
    setCaption('');
    startTransition(() => router.refresh());
  }

  function handleDelete(itemId: string) {
    startTransition(async () => {
      await deleteAction(weddingId, itemId);
      router.refresh();
    });
  }

  const items = filter === 'ALL' ? initialItems : initialItems.filter(i => i.category === filter);

  return (
    <div className="space-y-6">
      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-medium border ${filter === 'ALL' ? 'bg-[#7B2D42] text-white border-[#7B2D42]' : 'bg-white text-muted-foreground border-[#C5A47E]/30'}`}
        >All ({initialItems.length})</button>
        {CATEGORIES.map(c => {
          const count = initialItems.filter(i => i.category === c).length;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${filter === c ? 'bg-[#7B2D42] text-white border-[#7B2D42]' : 'bg-white text-muted-foreground border-[#C5A47E]/30'}`}
            >{c.toLowerCase()} {count > 0 && <span className="opacity-70">({count})</span>}</button>
          );
        })}
      </div>

      {/* Upload form */}
      <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-[#0A1F4D] mb-3">Add inspiration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Caption</label>
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="What inspires you about this?"
              className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as MoodBoardCategory)}
              className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c.toLowerCase()}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <R2Uploader folder="photos" accept="image/*" label="Upload photo" onUploaded={handleUploaded} />
        </div>
      </div>

      {/* Gallery */}
      {items.length === 0 ? (
        <div className="bg-white border border-dashed border-[#C5A47E]/30 rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">No inspiration {filter !== 'ALL' ? `in ${filter.toLowerCase()}` : 'yet'}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm overflow-hidden group relative">
              {item.url ? (
                <div className="aspect-square relative">
                  <Image src={item.url} alt={item.caption ?? ''} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" unoptimized />
                </div>
              ) : (
                <div className="aspect-square bg-[#F5EFE8]" />
              )}
              <button
                onClick={() => handleDelete(item.id)}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete"
              >×</button>
              <div className="p-2">
                <p className="text-xs text-[#7B2D42] font-medium uppercase">{item.category.toLowerCase()}</p>
                {item.caption && <p className="text-xs text-muted-foreground line-clamp-2">{item.caption}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
