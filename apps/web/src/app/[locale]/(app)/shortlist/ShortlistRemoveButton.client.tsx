'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { BookmarkX, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { clientEnv } from '@/lib/env';

interface Props {
  targetProfileId: string;
  name: string;
}

/** Remove-from-shortlist affordance for the shortlist grid cards. */
export function ShortlistRemoveButton({ targetProfileId, name }: Props) {
  const t = useTranslations('shortlist');
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${clientEnv.apiUrl}/api/v1/matchmaking/shortlists/${targetProfileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok && res.status !== 404) {
        toast(t('removeFailed'), 'error');
        return;
      }
      toast(t('removed', { name }), 'success');
      router.refresh();
    } catch {
      toast(t('removeFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label={t('removeAria', { name })}
      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <BookmarkX className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {t('removeLabel')}
    </button>
  );
}
