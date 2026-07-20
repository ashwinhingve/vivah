import { getTranslations } from 'next-intl/server';
import { Users, Sparkles, Plus, X } from 'lucide-react';
import { fetchSeating } from '@/lib/wedding-api';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import type { GuestSummary } from '@smartshaadi/types';
import { createTableAction, deleteTableAction, assignSeatAction, unassignSeatAction, autoAssignAction } from './actions';

interface PageProps { params: Promise<{ locale: string; id: string }> }

export default async function SeatingPage({ params }: PageProps) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'weddings.seating' });
  const [seatingRes, guestsRes] = await Promise.all([
    fetchSeating(id),
    fetchAuth<{ guests: GuestSummary[] }>(`/api/v1/weddings/${id}/guests`),
  ]);
  const tables = seatingRes?.tables ?? [];
  const guests = guestsRes?.guests ?? [];
  const seatedIds = new Set(tables.flatMap(table => table.assignedGuests.map(g => g.guestId)));
  const unseated = guests.filter(g => !seatedIds.has(g.id) && g.rsvpStatus === 'YES');

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
          <div className="flex items-center justify-between mb-6">
            <div>
              <PageHeader
                title={t('heading')}
                subtitle={t('subtitle', { tableCount: tables.length, seatedCount: seatedIds.size, totalConfirmed: guests.filter(g => g.rsvpStatus === 'YES').length })}
              />
            </div>
            {tables.length > 0 && unseated.length > 0 && (
              <form action={autoAssignAction.bind(null, id)}>
                <button type="submit" className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('autoAssign')}
                </button>
              </form>
            )}
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tables */}
          <div className="lg:col-span-2 space-y-4">
            {tables.length === 0 ? (
              <div className="bg-surface border border-dashed border-gold/30 rounded-2xl p-12 text-center">
                <Users className="h-10 w-10 text-gold mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('noTablesYet')}</p>
              </div>
            ) : (
              tables.map(table => {
                const filled = table.assignedGuests.length;
                return (
                  <div key={table.id} className="bg-surface border border-gold/20 rounded-2xl shadow-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-primary">{table.name}</h3>
                        <p className="text-xs text-muted-foreground">{table.shape.toLowerCase()} · {filled}/{table.capacity} seats</p>
                      </div>
                      <form action={deleteTableAction.bind(null, id, table.id)}>
                        <button type="submit" className="text-xs text-destructive hover:underline">{t('delete')}</button>
                      </form>
                    </div>

                    <ul className="space-y-1 mb-3">
                      {table.assignedGuests.map(g => (
                        <li key={g.guestId} className="flex items-center justify-between text-sm bg-background rounded px-3 py-1.5">
                          <span>{g.guestName}</span>
                          <form action={unassignSeatAction.bind(null, id, table.id, g.guestId)}>
                            <button type="submit" className="text-xs text-muted-foreground hover:text-destructive" aria-label="Unassign">
                              <X className="h-3 w-3" />
                            </button>
                          </form>
                        </li>
                      ))}
                      {filled === 0 && <p className="text-xs text-muted-foreground italic">{t('empty')}</p>}
                    </ul>

                    {filled < table.capacity && unseated.length > 0 && (
                      <form action={assignSeatAction.bind(null, id, table.id)} className="flex gap-2">
                        <select name="guestId" className="flex-1 min-h-[44px] rounded border border-gold/30 px-2 py-1 text-xs">
                          {unseated.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <button type="submit" className="min-h-[44px] px-3 rounded bg-teal text-white text-xs">{t('seat')}</button>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-surface border border-gold/20 rounded-2xl shadow-card p-5">
              <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" /> {t('newTable')}
              </h3>
              <form action={createTableAction.bind(null, id)} className="space-y-3">
                <input name="name" placeholder={t('tableName')} required className="w-full min-h-[44px] rounded border border-gold/30 px-3 py-1.5 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="capacity" type="number" min="2" max="50" defaultValue={8} className="w-full min-h-[44px] rounded border border-gold/30 px-3 py-1.5 text-sm" />
                  <select name="shape" className="w-full min-h-[44px] rounded border border-gold/30 px-3 py-1.5 text-sm">
                    <option value="ROUND">{t('shapeRound')}</option>
                    <option value="RECT">{t('shapeRect')}</option>
                    <option value="SQUARE">{t('shapeSquare')}</option>
                    <option value="OVAL">{t('shapeOval')}</option>
                  </select>
                </div>
                <button type="submit" className="w-full min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold">{t('addTable')}</button>
              </form>
            </div>

            <div className="bg-surface border border-gold/20 rounded-2xl shadow-card p-5">
              <h3 className="font-semibold text-primary mb-3">{t('unseatedCount', { count: unseated.length })}</h3>
              {unseated.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('allSeated')}</p>
              ) : (
                <ul className="space-y-1 max-h-64 overflow-y-auto text-sm">
                  {unseated.map(g => <li key={g.id} className="px-2 py-1 rounded bg-background">{g.name}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
        </div>
      </main>
    </PageTransition>
  );
}
