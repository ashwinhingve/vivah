import Link from 'next/link';
import { ArrowLeft, Gift, Plus } from 'lucide-react';
import { fetchRegistry } from '@/lib/wedding-api';
import { createRegistryItemAction, deleteRegistryItemAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-success/15 text-success',
  CLAIMED:   'bg-warning/15 text-warning',
  PURCHASED: 'bg-teal/10 text-teal',
};

export default async function RegistryPage({ params }: PageProps) {
  const { id } = await params;
  const r = await fetchRegistry(id);
  const items = r?.items ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-6 w-6 text-gold" />
          <h1 className="font-heading text-2xl text-primary">Gift Registry</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">List items guests can claim — appears on your public wedding website if enabled.</p>

        <div className="bg-surface border border-gold/20 rounded-xl shadow-sm mb-6">
          {items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No registry items yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gold/10">
              {items.map(i => (
                <li key={i.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{i.label}</p>
                    {i.description && <p className="text-xs text-muted-foreground">{i.description}</p>}
                    <div className="text-xs mt-1 flex gap-2">
                      {i.price && <span className="text-foreground">₹{i.price.toLocaleString('en-IN')}</span>}
                      <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[i.status] ?? ''}`}>{i.status.toLowerCase()}</span>
                      {i.claimedByName && <span className="text-muted-foreground">claimed by {i.claimedByName}</span>}
                    </div>
                  </div>
                  <form action={deleteRegistryItemAction.bind(null, id, i.id)}>
                    <button type="submit" className="text-xs text-destructive hover:underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <details className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
          <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium text-primary list-none">
            <Plus className="h-4 w-4" /> Add registry item
          </summary>
          <form action={createRegistryItemAction.bind(null, id)} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Item *</label>
              <input name="label" required className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Price (₹)</label>
              <input name="price" type="number" min="0" step="1" className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">External link</label>
              <input name="externalUrl" type="url" placeholder="https://" className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <textarea name="description" rows={2} className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="md:col-span-2 min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold">Add to registry</button>
          </form>
        </details>
      </div>
    </div>
  );
}
