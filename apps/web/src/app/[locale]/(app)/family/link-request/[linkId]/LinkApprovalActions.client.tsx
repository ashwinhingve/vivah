'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { approveLink, revokeLink } from '@/lib/family-mode-api';

export function LinkApprovalActions({ linkId }: { linkId: string }) {
  const t = useTranslations('family.pages.linkApprovalActions');
  const [err, setErr] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  function handle(kind: 'approve' | 'reject') {
    setErr(null);
    startTransition(async () => {
      const result = kind === 'approve'
        ? await approveLink(linkId)
        : await revokeLink(linkId);
      if (!result) { setErr(t('error')); return; }
      router.replace('/family/parent-mode');
    });
  }

  return (
    <div className="space-y-3">
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => handle('approve')}
          className="rounded-lg bg-primary text-primary-foreground px-4 h-11 text-sm hover:opacity-95 disabled:opacity-60"
        >
          {t('approve')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle('reject')}
          className="rounded-lg border border-destructive/40 text-destructive px-4 h-11 text-sm hover:bg-destructive/5 disabled:opacity-60"
        >
          {t('reject')}
        </button>
      </div>
    </div>
  );
}
