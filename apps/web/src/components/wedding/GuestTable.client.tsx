'use client';

import { useState, useTransition } from 'react';
import { Plus, ChevronUp, ChevronDown, Loader2, Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GuestSummary, RsvpStatus, MealPref } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface GuestTableProps {
  weddingId: string;
  initialGuests: GuestSummary[];
}

const RSVP_COLORS: Record<RsvpStatus, string> = {
  YES:     'bg-green-100 text-green-800',
  NO:      'bg-red-100 text-red-700',
  MAYBE:   'bg-amber-100 text-amber-800',
  PENDING: 'bg-gray-100 text-gray-600',
};

const MEAL_LABELS: Record<MealPref, string> = {
  VEG:     'Veg',
  NON_VEG: 'Non-Veg',
  JAIN:    'Jain',
  VEGAN:   'Vegan',
};

type SortKey = 'name' | 'rsvpStatus' | 'mealPref' | 'relationship';
type SortDir = 'asc' | 'desc';

interface AddGuestResponse {
  success: boolean;
  data?: GuestSummary;
  error?: string;
}

export function GuestTable({ weddingId, initialGuests }: GuestTableProps) {
  const [guests, setGuests] = useState<GuestSummary[]>(initialGuests);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  // Add guest form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', relationship: '', mealPref: '' as MealPref | '',
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, startAdding] = useTransition();

  // Send invitation
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  // Bulk import (paste newline-separated names)
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isBulkImporting, startBulkImporting] = useTransition();

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = guests.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      (g.relationship ?? '').toLowerCase().includes(q) ||
      (g.phone ?? '').includes(q)
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

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setAddError(null);

    startAdding(async () => {
      try {
        const body: Record<string, unknown> = { name: form.name.trim() };
        if (form.phone)        body['phone']        = form.phone;
        if (form.email)        body['email']        = form.email;
        if (form.relationship) body['relationship'] = form.relationship;
        if (form.mealPref)     body['mealPref']     = form.mealPref;

        const res = await fetch(`${API_URL}/api/v1/weddings/${weddingId}/guests`, {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(body),
          credentials: 'include',
        });
        const json = (await res.json()) as AddGuestResponse;
        if (json.success && json.data) {
          setGuests((prev) => [json.data!, ...prev]);
          setForm({ name: '', phone: '', email: '', relationship: '', mealPref: '' });
          setShowForm(false);
        } else {
          setAddError(json.error ?? 'Could not add guest.');
        }
      } catch {
        setAddError('Network error. Please try again.');
      }
    });
  }

  function sendInvitation(guestId: string) {
    setSendingId(guestId);
    setSendError(null);
    startSending(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/weddings/${weddingId}/invitations/send`,
          {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ guestIds: [guestId], channel: 'EMAIL' }),
            credentials: 'include',
          },
        );
        if (!res.ok) {
          const json = await res.json().catch(() => null) as
            | { error?: { message?: string } }
            | null;
          throw new Error(json?.error?.message ?? `status ${res.status}`);
        }
      } catch (e) {
        setSendError(e instanceof Error ? e.message : 'Failed to send invitation');
      } finally {
        setSendingId(null);
      }
    });
  }

  function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    setBulkError(null);
    const names = bulkText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setBulkError('Paste at least one name');
      return;
    }
    if (names.length > 500) {
      setBulkError('Maximum 500 guests per import');
      return;
    }

    startBulkImporting(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/weddings/${weddingId}/guests/bulk`,
          {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ guests: names.map((name) => ({ name })) }),
            credentials: 'include',
          },
        );
        if (!res.ok) {
          const json = await res.json().catch(() => null) as
            | { error?: { message?: string } }
            | null;
          throw new Error(json?.error?.message ?? `status ${res.status}`);
        }
        const json = (await res.json()) as {
          success: boolean;
          data?: { imported: number; guests: GuestSummary[] };
          error?: { message?: string };
        };
        if (!json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Import failed');
        }
        setGuests((prev) => [...prev, ...json.data!.guests]);
        setBulkText('');
        setShowBulk(false);
      } catch (e) {
        setBulkError(e instanceof Error ? e.message : 'Failed to import');
      }
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          placeholder="Search guests…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2.5 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B]"
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
          onClick={() => setShowBulk((v) => !v)}
          className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0 border border-[#C5A47E]/40 bg-white text-[#7B2D42] hover:bg-[#FEFAF6]"
        >
          Import List
        </button>
      </div>

      {/* Bulk import */}
      {showBulk && (
        <form
          onSubmit={handleBulkImport}
          className="mb-4 bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-4"
        >
          <label className="text-sm font-medium text-[#7B2D42] block mb-2">
            Paste guest names (one per line, max 500)
          </label>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            placeholder={'Priya Sharma\nRohan Verma\nAnita Desai'}
            className="w-full rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B]"
          />
          {bulkError && (
            <p className="mt-2 text-xs text-red-600">{bulkError}</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              type="submit"
              disabled={isBulkImporting}
              className="min-h-[44px] px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#0E7C7B' }}
            >
              {isBulkImporting ? 'Importing…' : 'Import'}
            </button>
            <button
              type="button"
              onClick={() => { setShowBulk(false); setBulkError(null); }}
              className="min-h-[44px] px-4 rounded-lg border border-[#C5A47E]/40 text-sm text-muted-foreground hover:text-[#7B2D42]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sendError && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {sendError}
        </div>
      )}

      {/* Add guest form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 mb-4"
        >
          {addError && (
            <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addError}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              name="name"
              type="text"
              placeholder="Full name *"
              value={form.name}
              onChange={handleFormChange}
              required
              className="min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B]"
            />
            <input
              name="relationship"
              type="text"
              placeholder="Relationship (e.g. Cousin)"
              value={form.relationship}
              onChange={handleFormChange}
              className="min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B]"
            />
            <input
              name="phone"
              type="tel"
              placeholder="Phone"
              value={form.phone}
              onChange={handleFormChange}
              className="min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B]"
            />
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleFormChange}
              className="min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B]"
            />
            <select
              name="mealPref"
              value={form.mealPref}
              onChange={handleFormChange}
              className="min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B]"
            >
              <option value="">Meal preference</option>
              <option value="VEG">Veg</option>
              <option value="NON_VEG">Non-Veg</option>
              <option value="JAIN">Jain</option>
              <option value="VEGAN">Vegan</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[44px] px-4 rounded-lg border border-[#C5A47E]/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding}
              className="min-h-[44px] px-4 rounded-lg text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5"
              style={{ backgroundColor: '#0E7C7B' }}
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Guest'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="bg-white border border-dashed border-[#C5A47E]/30 rounded-xl p-10 text-center">
          <p className="text-muted-foreground text-sm">
            {search ? 'No guests match your search.' : 'No guests added yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-[#C5A47E]/10 bg-[#FEFAF6]">
                <SortHeader col="name"         label="Name"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader col="relationship" label="Relationship" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader col="rsvpStatus"   label="RSVP"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader col="mealPref"     label="Meal"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((guest, i) => (
                <tr
                  key={guest.id}
                  className={`border-b border-[#C5A47E]/10 last:border-0 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-[#FEFAF6]/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{guest.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      {guest.phone && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Phone className="h-2.5 w-2.5" />
                          {guest.phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {guest.relationship ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        RSVP_COLORS[guest.rsvpStatus]
                      )}
                    >
                      {guest.rsvpStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {guest.mealPref ? MEAL_LABELS[guest.mealPref] : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => sendInvitation(guest.id)}
                      disabled={isSending && sendingId === guest.id}
                      aria-label={`Send invitation to ${guest.name}`}
                      className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg text-xs text-[#0E7C7B] border border-[#0E7C7B]/30 hover:bg-[#0E7C7B]/10 disabled:opacity-50 transition-colors"
                    >
                      {isSending && sendingId === guest.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      Invite
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
}: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th
      className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={active ? 'text-[#0E7C7B]' : ''}>
          {sortDir === 'asc' || !active
            ? <ChevronUp className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />}
        </span>
      </span>
    </th>
  );
}
