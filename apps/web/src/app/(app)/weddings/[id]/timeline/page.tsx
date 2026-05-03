import Link from 'next/link';
import { ArrowLeft, Clock, MapPin, Sparkles, Plus } from 'lucide-react';
import { fetchTimeline } from '@/lib/wedding-api';
import { fetchAuth } from '@/lib/server-fetch';
import type { Ceremony } from '@smartshaadi/types';
import { createEventAction, deleteEventAction, autoGenerateAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default async function TimelinePage({ params }: PageProps) {
  const { id } = await params;
  const [eventsRes, cersRes] = await Promise.all([
    fetchTimeline(id),
    fetchAuth<{ ceremonies: Ceremony[] }>(`/api/v1/weddings/${id}/ceremonies`),
  ]);
  const events = eventsRes?.events ?? [];
  const cers = cersRes?.ceremonies ?? [];

  // Group by date
  const byDate = new Map<string, typeof events>();
  for (const e of events) {
    const d = e.startTime.slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(e);
  }
  const dates = [...byDate.keys()].sort();

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl text-primary">Day-of Schedule</h1>
          {cers.length > 0 && events.length === 0 && (
            <form action={autoGenerateAction.bind(null, id)}>
              <button type="submit" className="flex items-center gap-2 min-h-[40px] px-4 rounded-lg bg-primary text-white text-sm font-medium">
                <Sparkles className="h-4 w-4" /> Auto-generate from ceremonies
              </button>
            </form>
          )}
        </div>

        {dates.length === 0 ? (
          <div className="bg-surface border border-dashed border-gold/30 rounded-xl p-12 text-center">
            <Clock className="h-10 w-10 text-gold mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No schedule events yet.</p>
            {cers.length > 0 ? (
              <form action={autoGenerateAction.bind(null, id)}>
                <button type="submit" className="inline-flex items-center gap-2 min-h-[44px] px-6 rounded-lg bg-primary text-white text-sm font-medium">
                  <Sparkles className="h-4 w-4" /> Generate from your ceremonies
                </button>
              </form>
            ) : (
              <p className="text-xs text-muted-foreground">Add ceremonies first, then auto-generate a schedule.</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {dates.map(d => (
              <div key={d} className="bg-surface border border-gold/20 rounded-xl shadow-sm">
                <div className="px-5 py-3 border-b border-gold/10 bg-background">
                  <p className="font-semibold text-primary">{fmtDate(d)}</p>
                </div>
                <ol className="divide-y divide-[#C5A47E]/10">
                  {byDate.get(d)!.map(e => (
                    <li key={e.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="text-right shrink-0 w-20">
                        <p className="font-semibold text-sm text-primary">{fmtTime(e.startTime)}</p>
                        {e.endTime && <p className="text-xs text-muted-foreground">{fmtTime(e.endTime)}</p>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{e.title}</p>
                        {e.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {e.location}
                          </p>
                        )}
                        {e.description && <p className="text-xs text-muted-foreground mt-1">{e.description}</p>}
                      </div>
                      <form action={deleteEventAction.bind(null, id, e.id)}>
                        <button type="submit" className="text-xs text-destructive hover:underline" aria-label="Delete">×</button>
                      </form>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* Add event */}
        <details className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5 mt-6">
          <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium text-primary list-none">
            <Plus className="h-4 w-4" /> Add event
          </summary>
          <form action={createEventAction.bind(null, id)} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
              <input name="title" required className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
              <input name="date" type="date" required className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Ceremony</label>
              <select name="ceremonyId" className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm">
                <option value="">— None —</option>
                {cers.map(c => <option key={c.id} value={c.id}>{c.type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start *</label>
              <input name="startTime" type="time" required className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">End</label>
              <input name="endTime" type="time" className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
              <input name="location" className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <textarea name="description" rows={2} className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="md:col-span-2 min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold">Add to schedule</button>
          </form>
        </details>
      </div>
    </div>
  );
}
