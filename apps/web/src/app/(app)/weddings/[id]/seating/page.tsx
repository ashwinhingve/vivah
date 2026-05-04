import Link from 'next/link';
import { ArrowLeft, Users, Sparkles, Plus, X } from 'lucide-react';
import { fetchSeating } from '@/lib/wedding-api';
import { fetchAuth } from '@/lib/server-fetch';
import type { GuestSummary } from '@smartshaadi/types';
import { createTableAction, deleteTableAction, assignSeatAction, unassignSeatAction, autoAssignAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

export default async function SeatingPage({ params }: PageProps) {
  const { id } = await params;
  const [seatingRes, guestsRes] = await Promise.all([
    fetchSeating(id),
    fetchAuth<{ guests: GuestSummary[] }>(`/api/v1/weddings/${id}/guests`),
  ]);
  const tables = seatingRes?.tables ?? [];
  const guests = guestsRes?.guests ?? [];
  const seatedIds = new Set(tables.flatMap(t => t.assignedGuests.map(g => g.guestId)));
  const unseated = guests.filter(g => !seatedIds.has(g.id) && g.rsvpStatus === 'YES');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl text-primary">Seating Plan</h1>
            <p className="text-sm text-muted-foreground">{tables.length} tables · {seatedIds.size} of {guests.filter(g => g.rsvpStatus === 'YES').length} confirmed guests seated</p>
          </div>
          {tables.length > 0 && unseated.length > 0 && (
            <form action={autoAssignAction.bind(null, id)}>
              <button type="submit" className="flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-primary text-white text-sm font-medium">
                <Sparkles className="h-4 w-4" /> Auto-assign
              </button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tables */}
          <div className="lg:col-span-2 space-y-4">
            {tables.length === 0 ? (
              <div className="bg-surface border border-dashed border-gold/30 rounded-xl p-12 text-center">
                <Users className="h-10 w-10 text-gold mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No tables yet. Add your first table on the right.</p>
              </div>
            ) : (
              tables.map(t => {
                const filled = t.assignedGuests.length;
                return (
                  <div key={t.id} className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-primary">{t.name}</h3>
                        <p className="text-xs text-muted-foreground">{t.shape.toLowerCase()} · {filled}/{t.capacity} seats</p>
                      </div>
                      <form action={deleteTableAction.bind(null, id, t.id)}>
                        <button type="submit" className="text-xs text-destructive hover:underline">Delete</button>
                      </form>
                    </div>

                    <ul className="space-y-1 mb-3">
                      {t.assignedGuests.map(g => (
                        <li key={g.guestId} className="flex items-center justify-between text-sm bg-background rounded px-3 py-1.5">
                          <span>{g.guestName}</span>
                          <form action={unassignSeatAction.bind(null, id, t.id, g.guestId)}>
                            <button type="submit" className="text-xs text-muted-foreground hover:text-destructive" aria-label="Unassign">
                              <X className="h-3 w-3" />
                            </button>
                          </form>
                        </li>
                      ))}
                      {filled === 0 && <p className="text-xs text-muted-foreground italic">Empty</p>}
                    </ul>

                    {filled < t.capacity && unseated.length > 0 && (
                      <form action={assignSeatAction.bind(null, id, t.id)} className="flex gap-2">
                        <select name="guestId" className="flex-1 min-h-[44px] rounded border border-gold/30 px-2 py-1 text-xs">
                          {unseated.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <button type="submit" className="min-h-[44px] px-3 rounded bg-teal text-white text-xs">Seat</button>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" /> New table
              </h3>
              <form action={createTableAction.bind(null, id)} className="space-y-3">
                <input name="name" placeholder="Table name" required className="w-full min-h-[44px] rounded border border-gold/30 px-3 py-1.5 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="capacity" type="number" min="2" max="50" defaultValue={8} className="w-full min-h-[44px] rounded border border-gold/30 px-3 py-1.5 text-sm" />
                  <select name="shape" className="w-full min-h-[44px] rounded border border-gold/30 px-3 py-1.5 text-sm">
                    <option value="ROUND">Round</option>
                    <option value="RECT">Rectangle</option>
                    <option value="SQUARE">Square</option>
                    <option value="OVAL">Oval</option>
                  </select>
                </div>
                <button type="submit" className="w-full min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold">Add table</button>
              </form>
            </div>

            <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-primary mb-3">Unseated ({unseated.length})</h3>
              {unseated.length === 0 ? (
                <p className="text-xs text-muted-foreground">All confirmed guests are seated.</p>
              ) : (
                <ul className="space-y-1 max-h-64 overflow-y-auto text-sm">
                  {unseated.map(g => <li key={g.id} className="px-2 py-1 rounded bg-background">{g.name}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
