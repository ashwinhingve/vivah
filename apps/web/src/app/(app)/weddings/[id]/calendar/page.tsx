import { fetchAuth } from '@/lib/server-fetch';
import type { Ceremony } from '@smartshaadi/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { CalendarRange } from 'lucide-react';

export const metadata = { title: 'Wedding Calendar' };
export const dynamic = 'force-dynamic';

export default async function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchAuth<{ ceremonies: Ceremony[] }>(`/api/v1/weddings/${id}/ceremonies`);
  const ceremonies = (data?.ceremonies ?? []).slice().sort((a, b) =>
    (a.date ?? '~').localeCompare(b.date ?? '~') || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
  );

  // Group by date for visual stack
  const byDate = new Map<string, Ceremony[]>();
  for (const c of ceremonies) {
    const k = c.date ?? 'TBD';
    const arr = byDate.get(k) ?? [];
    arr.push(c);
    byDate.set(k, arr);
  }

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl text-foreground">Wedding calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All ceremonies in chronological order. Click any to view details or jump to day-of.
        </p>
      </header>

      {byDate.size === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No ceremonies yet"
          description="Add your first ceremony from the wedding overview to see it here."
        />
      ) : (
        <ol className="space-y-6">
          {[...byDate.entries()].map(([date, list]) => (
            <li key={date}>
              <h2 className="mb-2 font-heading text-lg text-foreground">
                {date === 'TBD' ? 'Date TBD' : new Date(date).toLocaleDateString(undefined, {
                  weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((c) => (
                  <li key={c.id} className="rounded-xl border border-foreground/10 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{c.type}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        c.status === 'IN_PROGRESS' ? 'bg-emerald-100 text-emerald-700' :
                        c.status === 'COMPLETED'   ? 'bg-foreground/10 text-foreground' :
                        c.status === 'CANCELLED'   ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {c.startTime ?? '—'}{c.endTime ? ` – ${c.endTime}` : ''}
                      {c.venue ? ` · ${c.venue}` : ''}
                    </p>
                    {c.dressCode ? <p className="mt-1 text-xs text-muted-foreground">Dress: {c.dressCode}</p> : null}
                    {c.expectedGuests ? <p className="mt-1 text-xs text-muted-foreground">Guests: {c.expectedGuests}</p> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
