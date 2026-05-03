'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Plus, ChevronUp, ChevronDown, Loader2, Mail, Phone, Star, Pencil,
  Trash2, Download, Upload, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { GuestEditModal } from './GuestEditModal.client';
import {
  addGuestAction, deleteGuestAction, importGuestsCsvAction, fetchGuestsRichAction,
} from '@/app/(app)/weddings/[id]/guests/actions';
import type {
  GuestRich, RsvpStatus, MealPref, Ceremony,
} from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface GuestTableProps {
  weddingId:    string;
  initialGuests: GuestRich[];
  ceremonies?:  Pick<Ceremony, 'id' | 'type'>[];
}

const RSVP_COLORS: Record<RsvpStatus, string> = {
  YES:     'bg-green-100 text-green-800',
  NO:      'bg-destructive/15 text-destructive',
  MAYBE:   'bg-amber-100 text-amber-800',
  PENDING: 'bg-secondary text-muted-foreground',
};

const MEAL_LABELS: Record<MealPref, string> = {
  VEG:           'Veg',
  NON_VEG:       'Non-Veg',
  JAIN:          'Jain',
  VEGAN:         'Vegan',
  EGGETARIAN:    'Eggetarian',
  NO_PREFERENCE: 'No preference',
};

type SortKey = 'name' | 'rsvpStatus' | 'mealPref' | 'relationship' | 'side';
type SortDir = 'asc' | 'desc';

export function GuestTable({ weddingId, initialGuests, ceremonies = [] }: GuestTableProps) {
  const { toast } = useToast();
  const [guests, setGuests] = useState<GuestRich[]>(initialGuests);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  // Add guest form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', relationship: '', mealPref: '' as MealPref | '',
    side: '' as 'BRIDE' | 'GROOM' | 'BOTH' | '',
  });
  const [isAdding, startAdding] = useTransition();

  // Send invitation
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  // CSV import
  const [isImporting, startImporting] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit + delete
  const [editGuest, setEditGuest]     = useState<GuestRich | null>(null);
  const [deleteGuest, setDeleteGuest] = useState<GuestRich | null>(null);
  const [isDeleting, startDeleting]   = useTransition();

  function handleSort(key: SortKey): void {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = guests.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      (g.relationship ?? '').toLowerCase().includes(q) ||
      (g.phone ?? '').includes(q) ||
      (g.email ?? '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let av = (a[sortKey] ?? '') as string;
    let bv = (b[sortKey] ?? '') as string;
    av = av.toLowerCase();
    bv = bv.toLowerCase();
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleAdd(e: React.FormEvent): void {
    e.preventDefault();
    if (!form.name.trim()) return;

    startAdding(async () => {
      const body: Record<string, unknown> = { name: form.name.trim() };
      if (form.phone)        body['phone']        = form.phone;
      if (form.email)        body['email']        = form.email;
      if (form.relationship) body['relationship'] = form.relationship;
      if (form.mealPref)     body['mealPref']     = form.mealPref;
      if (form.side)         body['side']         = form.side;

      const r = await addGuestAction(weddingId, body);
      if (r.ok && r.data) {
        setGuests((prev) => [r.data!, ...prev]);
        setForm({ name: '', phone: '', email: '', relationship: '', mealPref: '', side: '' });
        setShowForm(false);
        toast('Guest added', 'success');
      } else {
        toast(r.error ?? 'Could not add guest', 'error');
      }
    });
  }

  function sendInvitation(guestId: string): void {
    setSendingId(guestId);
    startSending(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/weddings/${weddingId}/invitations/send`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestIds: [guestId], channel: 'EMAIL' }), credentials: 'include' },
        );
        if (!res.ok) {
          const json = await res.json().catch(() => null) as { error?: { message?: string } } | null;
          throw new Error(json?.error?.message ?? `status ${res.status}`);
        }
        toast('Invitation sent', 'success');
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Failed to send invitation', 'error');
      } finally {
        setSendingId(null);
      }
    });
  }

  async function refreshFromServer(): Promise<void> {
    const fresh = await fetchGuestsRichAction(weddingId);
    setGuests(fresh);
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { toast('CSV too large (>2MB)', 'error'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      startImporting(async () => {
        const r = await importGuestsCsvAction(weddingId, text);
        if (r.ok && r.data) {
          await refreshFromServer();
          toast(`Imported ${r.data.imported}${r.data.invalid.length ? `, ${r.data.invalid.length} skipped` : ''}`, 'success');
        } else {
          toast(r.error ?? 'CSV import failed', 'error');
        }
      });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleCsvExport(): void {
    window.open(`${API_URL}/api/v1/weddings/${weddingId}/guests/export.csv`, '_blank');
  }

  function confirmDelete(): void {
    if (!deleteGuest) return;
    const target = deleteGuest;
    startDeleting(async () => {
      const r = await deleteGuestAction(weddingId, target.id);
      if (r.ok) {
        setGuests((prev) => prev.filter((g) => g.id !== target.id));
        toast('Guest removed', 'success');
      } else {
        toast(r.error ?? 'Failed to delete', 'error');
      }
      setDeleteGuest(null);
    });
  }

  function onEditSaved(updated: GuestRich): void {
    setGuests((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    setEditGuest(null);
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <input
          type="search"
          placeholder="Search guests…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2.5 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B]"
        />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors shrink-0"
          style={{ backgroundColor: '#0E7C7B' }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Guest
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0 border border-[#C5A47E]/40 bg-surface text-[#7B2D42] hover:bg-[#FEFAF6] disabled:opacity-60"
        >
          {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="hidden" />
        <button
          onClick={handleCsvExport}
          className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0 border border-[#C5A47E]/40 bg-surface text-[#7B2D42] hover:bg-[#FEFAF6]"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Add guest form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 mb-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input name="name" type="text" placeholder="Full name *" value={form.name} onChange={handleFormChange} required className={inputCls} />
            <input name="relationship" type="text" placeholder="Relationship (e.g. Cousin)" value={form.relationship} onChange={handleFormChange} className={inputCls} />
            <input name="phone" type="tel" placeholder="Phone" value={form.phone} onChange={handleFormChange} className={inputCls} />
            <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleFormChange} className={inputCls} />
            <select name="side" value={form.side} onChange={handleFormChange} className={inputCls}>
              <option value="">Side</option>
              <option value="BRIDE">Bride's side</option>
              <option value="GROOM">Groom's side</option>
              <option value="BOTH">Both</option>
            </select>
            <select name="mealPref" value={form.mealPref} onChange={handleFormChange} className={inputCls}>
              <option value="">Meal preference</option>
              <option value="VEG">Veg</option>
              <option value="NON_VEG">Non-Veg</option>
              <option value="JAIN">Jain</option>
              <option value="VEGAN">Vegan</option>
              <option value="EGGETARIAN">Eggetarian</option>
              <option value="NO_PREFERENCE">No preference</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="min-h-[44px] px-4 rounded-lg border border-[#C5A47E]/40 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={isAdding} className="min-h-[44px] px-4 rounded-lg text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5" style={{ backgroundColor: '#0E7C7B' }}>
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Guest'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="bg-surface border border-dashed border-[#C5A47E]/30 rounded-xl p-10 text-center">
          <p className="text-muted-foreground text-sm">{search ? 'No guests match your search.' : 'No guests added yet.'}</p>
        </div>
      ) : (
        <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-[#C5A47E]/10 bg-[#FEFAF6]">
                <SortHeader col="name"         label="Name"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader col="relationship" label="Relationship" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader col="side"         label="Side"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader col="rsvpStatus"   label="RSVP"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader col="mealPref"     label="Meal"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((guest, i) => (
                <tr key={guest.id} className={`border-b border-[#C5A47E]/10 last:border-0 ${i % 2 === 0 ? 'bg-surface' : 'bg-[#FEFAF6]/50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {guest.isVip && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" aria-label="VIP" />}
                      <p className="font-medium text-foreground">{guest.name}</p>
                      {guest.ageGroup !== 'ADULT' && (
                        <span className="text-[10px] uppercase tracking-wide bg-[#C5A47E]/20 text-[#7B2D42] rounded-full px-1.5 py-0.5">{guest.ageGroup}</span>
                      )}
                      {guest.arrivedAt && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-label="Checked in" />}
                    </div>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      {guest.phone && <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"><Phone className="h-2.5 w-2.5" />{guest.phone}</span>}
                      {guest.plusOnes > 0 && <span className="text-[10px] text-muted-foreground">+{guest.plusOnes}</span>}
                      {guest.invitedToCeremonies.length > 0 && <span className="text-[10px] text-muted-foreground">{guest.invitedToCeremonies.length} ceremon{guest.invitedToCeremonies.length === 1 ? 'y' : 'ies'}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{guest.relationship ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{guest.side ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', RSVP_COLORS[guest.rsvpStatus])}>{guest.rsvpStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{guest.mealPref ? MEAL_LABELS[guest.mealPref] : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => sendInvitation(guest.id)}
                        disabled={isSending && sendingId === guest.id}
                        aria-label={`Send invitation to ${guest.name}`}
                        className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg text-xs text-[#0E7C7B] border border-[#0E7C7B]/30 hover:bg-[#0E7C7B]/10 disabled:opacity-50 transition-colors"
                      >
                        {isSending && sendingId === guest.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                        Invite
                      </button>
                      <button
                        onClick={() => setEditGuest(guest)}
                        aria-label={`Edit ${guest.name}`}
                        className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg text-xs text-muted-foreground border border-[#C5A47E]/40 hover:bg-[#FEFAF6]"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteGuest(guest)}
                        aria-label={`Delete ${guest.name}`}
                        className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg text-xs text-destructive border border-destructive/30 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editGuest && (
        <GuestEditModal
          weddingId={weddingId}
          guest={editGuest}
          ceremonies={ceremonies}
          onSaved={onEditSaved}
          onCancel={() => setEditGuest(null)}
        />
      )}

      <ConfirmDialog
        open={deleteGuest !== null}
        title="Remove guest?"
        description={deleteGuest ? `${deleteGuest.name} will be removed from your guest list. This cannot be undone.` : ''}
        confirmLabel={isDeleting ? 'Removing…' : 'Remove'}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteGuest(null)}
      />
    </div>
  );
}

const inputCls = 'min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B]';

function SortHeader({
  col, label, sortKey, sortDir, onSort,
}: {
  col: SortKey; label: string; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => onSort(col)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={active ? 'text-[#0E7C7B]' : ''}>
          {sortDir === 'asc' || !active ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </span>
    </th>
  );
}
