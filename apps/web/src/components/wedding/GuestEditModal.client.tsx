'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { updateGuestAction } from '@/app/(app)/weddings/[id]/guests/actions';
import type { GuestRich, Ceremony, RsvpStatus, MealPref, GuestSide, GuestAgeGroup } from '@smartshaadi/types';

interface Props {
  weddingId:   string;
  guest:       GuestRich;
  ceremonies?: Pick<Ceremony, 'id' | 'type'>[];
  onSaved:     (g: GuestRich) => void;
  onCancel:    () => void;
}

const RSVP_OPTS:   RsvpStatus[]    = ['PENDING', 'YES', 'NO', 'MAYBE'];
const MEAL_OPTS:   MealPref[]      = ['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN', 'NO_PREFERENCE'];
const SIDE_OPTS:   GuestSide[]     = ['BRIDE', 'GROOM', 'BOTH'];
const AGE_OPTS:    GuestAgeGroup[] = ['ADULT', 'CHILD', 'INFANT'];

export function GuestEditModal({ weddingId, guest, ceremonies = [], onSaved, onCancel }: Props) {
  const { toast } = useToast();
  const [isSaving, startSaving] = useTransition();
  const [name, setName] = useState(guest.name);
  const [phone, setPhone] = useState(guest.phone ?? '');
  const [email, setEmail] = useState(guest.email ?? '');
  const [relationship, setRelationship] = useState(guest.relationship ?? '');
  const [side, setSide] = useState<GuestSide | ''>(guest.side ?? '');
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>(guest.rsvpStatus);
  const [mealPref, setMealPref] = useState<MealPref | ''>(guest.mealPref ?? '');
  const [roomNumber, setRoomNumber] = useState(guest.roomNumber ?? '');
  const [plusOnes, setPlusOnes] = useState<number>(guest.plusOnes ?? 0);
  const [plusOneNames, setPlusOneNames] = useState<string[]>(guest.plusOneNames ?? []);
  const [ageGroup, setAgeGroup] = useState<GuestAgeGroup>(guest.ageGroup ?? 'ADULT');
  const [isVip, setIsVip] = useState<boolean>(guest.isVip ?? false);
  const [dietaryNotes, setDietaryNotes] = useState(guest.dietaryNotes ?? '');
  const [accessibilityNotes, setAccessibilityNotes] = useState(guest.accessibilityNotes ?? '');
  const [invitedToCeremonies, setInvitedToCeremonies] = useState<string[]>(guest.invitedToCeremonies ?? []);
  const [notes, setNotes] = useState(guest.notes ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  function toggleCeremony(id: string): void {
    setInvitedToCeremonies(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function setPlusOneName(idx: number, value: string): void {
    setPlusOneNames(prev => prev.map((v, i) => i === idx ? value : v));
  }

  function handleSave(e: React.FormEvent): void {
    e.preventDefault();
    if (!name.trim()) { toast('Name is required', 'error'); return; }

    const payload: Record<string, unknown> = {
      name:        name.trim(),
      rsvpStatus,
      ageGroup,
      isVip,
      plusOnes,
    };
    if (phone) payload['phone'] = phone;
    if (email) payload['email'] = email;
    if (relationship) payload['relationship'] = relationship;
    if (side) payload['side'] = side;
    if (mealPref) payload['mealPref'] = mealPref;
    if (roomNumber) payload['roomNumber'] = roomNumber;
    if (plusOneNames.length > 0) payload['plusOneNames'] = plusOneNames.filter(n => n.trim().length > 0);
    if (dietaryNotes) payload['dietaryNotes'] = dietaryNotes;
    if (accessibilityNotes) payload['accessibilityNotes'] = accessibilityNotes;
    if (invitedToCeremonies.length > 0) payload['invitedToCeremonies'] = invitedToCeremonies;
    if (notes) payload['notes'] = notes;

    startSaving(async () => {
      const r = await updateGuestAction(weddingId, guest.id, payload);
      if (r.ok && r.data) { toast('Guest updated', 'success'); onSaved(r.data); }
      else { toast(r.error ?? 'Failed to save', 'error'); }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-surface p-5 shadow-2xl my-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-semibold text-primary">Edit guest</h2>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Relationship">
            <input value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Phone">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Side">
            <select value={side} onChange={(e) => setSide(e.target.value as GuestSide | '')} className={inputCls}>
              <option value="">—</option>
              {SIDE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="RSVP">
            <select value={rsvpStatus} onChange={(e) => setRsvpStatus(e.target.value as RsvpStatus)} className={inputCls}>
              {RSVP_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Meal preference">
            <select value={mealPref} onChange={(e) => setMealPref(e.target.value as MealPref | '')} className={inputCls}>
              <option value="">—</option>
              {MEAL_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Age group">
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as GuestAgeGroup)} className={inputCls}>
              {AGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Room number">
            <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Plus-ones">
            <input
              type="number" min={0} max={8}
              value={plusOnes}
              onChange={(e) => setPlusOnes(Math.max(0, Math.min(8, Number(e.target.value) || 0)))}
              className={inputCls}
            />
          </Field>
        </div>

        {/* Plus-one names */}
        {plusOnes > 0 && (
          <div className="mt-3">
            <label className="text-xs font-medium text-muted-foreground">Plus-one names</label>
            <div className="space-y-1.5 mt-1.5">
              {Array.from({ length: plusOnes }).map((_, i) => (
                <input
                  key={i}
                  value={plusOneNames[i] ?? ''}
                  onChange={(e) => setPlusOneName(i, e.target.value)}
                  placeholder={`Plus-one ${i + 1}`}
                  className={inputCls}
                />
              ))}
              {plusOneNames.length > plusOnes && (
                <button type="button" onClick={() => setPlusOneNames(plusOneNames.slice(0, plusOnes))} className="text-xs text-muted-foreground hover:text-primary"><Plus className="inline h-3 w-3 rotate-45" /> trim</button>
              )}
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} className="h-4 w-4" />
            Mark as VIP
          </label>
        </div>

        <Field label="Dietary notes">
          <textarea rows={2} value={dietaryNotes} onChange={(e) => setDietaryNotes(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Accessibility notes">
          <textarea rows={2} value={accessibilityNotes} onChange={(e) => setAccessibilityNotes(e.target.value)} className={inputCls} />
        </Field>

        {ceremonies.length > 0 && (
          <Field label="Invited to ceremonies">
            <div className="flex flex-wrap gap-2">
              {ceremonies.map(c => (
                <label key={c.id} className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer ${invitedToCeremonies.includes(c.id) ? 'bg-teal/10 text-teal border-teal/40' : 'border-gold/40 text-muted-foreground'}`}>
                  <input type="checkbox" className="sr-only" checked={invitedToCeremonies.includes(c.id)} onChange={() => toggleCeremony(c.id)} />
                  {c.type}
                </label>
              ))}
            </div>
          </Field>
        )}

        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
        </Field>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onCancel} className="min-h-[44px] px-4 rounded-lg border border-gold/40 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={isSaving} className="min-h-[44px] px-4 rounded-lg text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5 bg-teal">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}
