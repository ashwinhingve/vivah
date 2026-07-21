'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { addFamilyMemberAction, removeFamilyMemberAction } from '@/app/[locale]/(app)/family/actions';
import type { FamilyMember, FamilyRelationship } from '@smartshaadi/types';

const RELATIONS: FamilyRelationship[] = [
  'FATHER', 'MOTHER', 'SIBLING', 'GUARDIAN', 'GRANDPARENT', 'UNCLE', 'AUNT', 'COUSIN', 'OTHER',
];

interface Props { initial: FamilyMember[]; }

export function FamilyMembersClient({ initial }: Props) {
  const t = useTranslations('family.components.familyMembersClient');
  const { toast } = useToast();
  const [members, setMembers] = useState<FamilyMember[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<FamilyRelationship>('SIBLING');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isManaging, setIsManaging] = useState(false);
  const [adding, startAdding] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDeleting] = useTransition();

  function handleAdd(e: React.FormEvent): void {
    e.preventDefault();
    if (!name.trim()) { toast(t('fullName'), 'error'); return; }
    const payload: Record<string, unknown> = { name: name.trim(), relationship };
    if (phone) payload['phone'] = phone;
    if (email) payload['email'] = email;
    if (notes) payload['notes'] = notes;
    if (isManaging) payload['isManaging'] = true;

    startAdding(async () => {
      const r = await addFamilyMemberAction(payload);
      if (r.ok && r.data) {
        setMembers(prev => [r.data!, ...prev]);
        setName(''); setRelationship('SIBLING'); setPhone(''); setEmail(''); setNotes(''); setIsManaging(false);
        setShowForm(false);
        toast(t('addedSuccess'), 'success');
      } else {
        toast(r.error ?? t('failedError'), 'error');
      }
    });
  }

  function confirmDelete(): void {
    if (!deletingId) return;
    const id = deletingId;
    startDeleting(async () => {
      const r = await removeFamilyMemberAction(id);
      if (r.ok) {
        setMembers(prev => prev.filter(m => m.id !== id));
        toast(t('removedSuccess'), 'success');
      } else {
        toast(r.error ?? t('failedError'), 'error');
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="bg-surface border border-gold/20 rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm text-primary">{t('heading')}</h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs px-3 min-h-[44px] rounded-lg text-white bg-teal"
        >
          <Plus className="h-3.5 w-3.5" /> {t('addButton')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-background rounded-lg p-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('fullName')}
              aria-label={t('fullName')}
              required
              className="min-h-[44px] rounded-lg border border-gold/40 bg-surface px-3 py-2 text-sm"
            />
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as FamilyRelationship)}
              aria-label={t('relationship')}
              className="min-h-[44px] rounded-lg border border-gold/40 bg-surface px-3 py-2 text-sm"
            >
              {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phone')} aria-label={t('phone')} className="min-h-[44px] rounded-lg border border-gold/40 bg-surface px-3 py-2 text-sm" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email')} aria-label={t('email')} className="min-h-[44px] rounded-lg border border-gold/40 bg-surface px-3 py-2 text-sm" />
          </div>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notes')}
            aria-label={t('notes')}
            className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-surface px-3 py-2 text-sm mb-2"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <input type="checkbox" checked={isManaging} onChange={(e) => setIsManaging(e.target.checked)} />
            {t('isManaging')}
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="min-h-[44px] px-3 rounded-lg border border-gold/40 text-xs text-muted-foreground">{t('cancel')}</button>
            <button type="submit" disabled={adding} className="min-h-[44px] px-3 rounded-lg text-white text-xs disabled:opacity-60 flex items-center gap-1.5 bg-teal">
              {adding && <Loader2 className="h-3 w-3 animate-spin" />} {t('addMember')}
            </button>
          </div>
        </form>
      )}

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{t('noMembers')}</p>
      ) : (
        <ul className="divide-y divide-gold/10">
          {members.map((m) => (
            <li key={m.id} className="py-2.5 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{m.name}</p>
                <p className="text-2xs text-muted-foreground">
                  {m.relationship}
                  {m.isManaging && ' · manages profile'}
                  {m.phone && ` · ${m.phone}`}
                </p>
              </div>
              <button onClick={() => setDeletingId(m.id)} className="text-destructive hover:bg-destructive/10 rounded p-1.5">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title={t('removeConfirmTitle')}
        description={t('removeConfirmDesc')}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
