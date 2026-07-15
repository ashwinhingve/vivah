'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, CheckCircle2 } from 'lucide-react';
import {
  createFamilyLinkAction,
  type ParentLinkRelationship,
  type ParentLinkPermission,
} from '@/app/[locale]/(app)/family/actions';

const RELATIONSHIPS: { value: ParentLinkRelationship; label: string }[] = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'SIBLING', label: 'Sibling' },
];

const PERMISSIONS: { value: ParentLinkPermission; label: string; hint: string }[] = [
  { value: 'VIEW_ONLY', label: 'View only', hint: 'See their profile & matches, no actions' },
  { value: 'DRAFT_ACTIONS', label: 'Draft actions', hint: 'Suggest interests they approve (recommended)' },
  { value: 'EDIT_PROFILE', label: 'Edit profile', hint: 'Help complete their profile details' },
  { value: 'FULL_PROXY', label: 'Full proxy', hint: 'Act on their behalf — highest trust' },
];

export function LinkRequestForm() {
  const router = useRouter();
  const [childUserId, setChildUserId] = useState('');
  const [relationship, setRelationship] = useState<ParentLinkRelationship>('FATHER');
  const [permission, setPermission] = useState<ParentLinkPermission>('DRAFT_ACTIONS');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';

  function submit() {
    const id = childUserId.trim();
    if (!id) {
      setError('Enter your family member’s account ID.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createFamilyLinkAction({
        childUserId: id,
        relationship,
        requestedPermissions: permission,
      });
      if (!r.ok) {
        setError(r.error ?? 'Could not send the request. Check the account ID and try again.');
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-6 text-center shadow-card">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
        <h2 className="mt-3 font-heading text-lg text-primary">Request sent</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your family member will see the request in their account. Once they approve it, they’ll
          appear on your family hub and you can start assisting them.
        </p>
        <button
          type="button"
          onClick={() => { setDone(false); setChildUserId(''); }}
          className="mt-4 inline-flex h-11 items-center rounded-lg border border-gold/30 bg-surface px-4 text-sm font-medium text-primary hover:border-gold/60"
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="space-y-5 rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6"
    >
      <div>
        <label htmlFor="childUserId" className="mb-1 block text-sm font-medium text-primary">
          Family member’s account ID
        </label>
        <input
          id="childUserId"
          value={childUserId}
          onChange={(e) => setChildUserId(e.target.value)}
          disabled={pending}
          placeholder="e.g. usr_a1b2c3…"
          className={inputCls}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Ask them to open their <span className="text-primary">Family requests</span> page and
          copy their <span className="text-primary">family code</span>. They must have their own
          Smart Shaadi account.
        </p>
      </div>

      <div>
        <label htmlFor="relationship" className="mb-1 block text-sm font-medium text-primary">
          Your relationship to them
        </label>
        <select
          id="relationship"
          value={relationship}
          disabled={pending}
          onChange={(e) => setRelationship(e.target.value as ParentLinkRelationship)}
          className={inputCls}
        >
          {RELATIONSHIPS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-primary">Access you’re requesting</legend>
        <div className="space-y-2">
          {PERMISSIONS.map((p) => (
            <label
              key={p.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                permission === p.value ? 'border-teal/50 bg-teal/5' : 'border-border bg-background hover:border-gold/40'
              }`}
            >
              <input
                type="radio"
                name="permission"
                value={p.value}
                checked={permission === p.value}
                disabled={pending}
                onChange={() => setPermission(p.value)}
                className="mt-0.5 h-4 w-4 accent-teal"
              />
              <span>
                <span className="block text-sm font-medium text-primary">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={pending || !childUserId.trim()}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {pending ? 'Sending…' : 'Send link request'}
      </button>
    </form>
  );
}
