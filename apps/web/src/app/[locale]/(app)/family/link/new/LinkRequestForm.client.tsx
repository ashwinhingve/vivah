'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { UserPlus, CheckCircle2 } from 'lucide-react';
import {
  createFamilyLinkAction,
  type ParentLinkRelationship,
  type ParentLinkPermission,
} from '@/app/[locale]/(app)/family/actions';

const RELATIONSHIPS: ParentLinkRelationship[] = ['FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING'];

const PERMISSIONS: { value: ParentLinkPermission }[] = [
  { value: 'VIEW_ONLY' },
  { value: 'DRAFT_ACTIONS' },
  { value: 'EDIT_PROFILE' },
  { value: 'FULL_PROXY' },
];

export function LinkRequestForm() {
  const t = useTranslations('family.pages.linkRequestForm');
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
      setError(t('errorRequired'));
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
        setError(r.error ?? t('errorDefault'));
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
        <h2 className="mt-3 font-heading text-lg text-primary">{t('successHeading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('successBody')}
        </p>
        <button
          type="button"
          onClick={() => { setDone(false); setChildUserId(''); }}
          className="mt-4 inline-flex h-11 items-center rounded-lg border border-gold/30 bg-surface px-4 text-sm font-medium text-primary hover:border-gold/60"
        >
          {t('successAgain')}
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
          {t('childUserIdLabel')}
        </label>
        <input
          id="childUserId"
          value={childUserId}
          onChange={(e) => setChildUserId(e.target.value)}
          disabled={pending}
          placeholder={t('childUserIdPlaceholder')}
          className={inputCls}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('childUserIdHint') }} />
      </div>

      <div>
        <label htmlFor="relationship" className="mb-1 block text-sm font-medium text-primary">
          {t('relationshipLabel')}
        </label>
        <select
          id="relationship"
          value={relationship}
          disabled={pending}
          onChange={(e) => setRelationship(e.target.value as ParentLinkRelationship)}
          className={inputCls}
        >
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>{t(`relationship.${r}`)}</option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-primary">{t('permissionLegend')}</legend>
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
                <span className="block text-sm font-medium text-primary">{t(`permission.${p.value}.label`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`permission.${p.value}.hint`)}</span>
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
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
