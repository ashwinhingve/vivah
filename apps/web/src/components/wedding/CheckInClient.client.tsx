'use client';

import { useState, useTransition, useMemo } from 'react';
import { CheckCircle2, Loader2, Undo2, Search } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { checkInGuestAction } from '@/app/(app)/weddings/[id]/guests/actions';
import type { GuestRich } from '@smartshaadi/types';

interface Props {
  weddingId: string;
  initialGuests: GuestRich[];
}

export function CheckInClient({ weddingId, initialGuests }: Props) {
  const { toast } = useToast();
  const [guests, setGuests] = useState<GuestRich[]>(initialGuests);
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startCheckIn] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests.slice(0, 50);
    return guests.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      (g.phone ?? '').includes(q) ||
      (g.email ?? '').toLowerCase().includes(q),
    ).slice(0, 50);
  }, [guests, search]);

  const checkedIn = guests.filter(g => g.arrivedAt).length;

  function toggleCheckIn(guest: GuestRich): void {
    setPendingId(guest.id);
    const wantState = !guest.arrivedAt;
    startCheckIn(async () => {
      const r = await checkInGuestAction(weddingId, guest.id, wantState);
      if (r.ok && r.data) {
        setGuests(prev => prev.map(g => g.id === guest.id ? r.data! : g));
        toast(wantState ? `${guest.name} checked in` : `${guest.name} reverted`, 'success');
      } else {
        toast(r.error ?? 'Failed', 'error');
      }
      setPendingId(null);
    });
  }

  return (
    <div>
      {/* Counter */}
      <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 mb-4 flex items-center justify-between">
        <div>
          <div className="text-3xl font-semibold text-[#0E7C7B]">{checkedIn}<span className="text-base text-muted-foreground"> / {guests.length}</span></div>
          <p className="text-xs text-muted-foreground">Guests checked in</p>
        </div>
        <p className="text-xs text-muted-foreground text-right max-w-[180px]">
          Tip: paste a guest&apos;s RSVP URL or phone to find them fast.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email"
          className="w-full min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-surface pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#0E7C7B]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No guests match.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((g) => {
            const arrived = !!g.arrivedAt;
            const pending = pendingId === g.id;
            return (
              <li key={g.id} className={`bg-surface border rounded-xl shadow-sm p-3 flex items-center justify-between gap-3 ${arrived ? 'border-green-200' : 'border-[#C5A47E]/20'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm flex items-center gap-1.5">
                    {arrived && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                    <span className="truncate">{g.name}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {g.relationship ?? '—'} · {g.rsvpStatus}{g.plusOnes > 0 ? ` · +${g.plusOnes}` : ''}{g.isVip ? ' · VIP' : ''}
                  </p>
                </div>
                <button
                  onClick={() => toggleCheckIn(g)}
                  disabled={pending}
                  className={`min-h-[44px] px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 shrink-0 ${arrived ? 'border border-[#C5A47E]/40 text-muted-foreground hover:bg-[#FEFAF6]' : 'text-white'}`}
                  style={arrived ? {} : { backgroundColor: '#0E7C7B' }}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : (arrived ? <Undo2 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />)}
                  {arrived ? 'Undo' : 'Check in'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
