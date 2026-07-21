'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { approveAction, rejectAction, type DraftedAction } from '@/lib/family-mode-api';

interface Props {
  action: DraftedAction;
  /** profileId → display name, so cards never show a raw UUID. */
  names?: Record<string, string | null>;
}

const STATUS_TONE: Record<string, StatusTone> = {
  EXECUTED: 'success',
  REJECTED: 'error',
  EXPIRED:  'neutral',
  PENDING:  'warning',
};

export function ParentActionCard({ action, names }: Props) {
  const t = useTranslations('family.components.parentActionCard');
  const locale = useLocale();
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  function handle(kind: 'approve' | 'reject') {
    setErr(null);
    startTransition(async () => {
      const result = kind === 'approve'
        ? await approveAction(action.id)
        : await rejectAction(action.id);
      if (!result) { setErr(t('actionFailed')); return; }
      router.refresh();
    });
  }

  const isPending = action.status === 'PENDING';

  const localeTag = locale === 'hi' ? 'hi-IN' : 'en-IN';

  function describePayload(): string {
    const p = action.payload as { targetProfileId?: string; message?: string; field?: string; value?: unknown };
    const who = (p.targetProfileId && names?.[p.targetProfileId]) || t('payload.someone');
    switch (action.actionType) {
      case 'SEND_INTEREST':
        return p.message
          ? t('payload.sendInterestWithMessage', { who, message: p.message })
          : t('payload.sendInterest', { who });
      case 'ACCEPT_INTEREST':  return t('payload.acceptInterest', { who });
      case 'REJECT_INTEREST':  return t('payload.rejectInterest', { who });
      case 'SEND_MESSAGE':     return t('payload.sendMessage', { message: p.message ?? '' });
      case 'UPDATE_PROFILE':   return t('payload.updateProfile', { field: p.field ?? '?' });
      case 'BLOCK_USER':       return t('payload.blockUser', { who });
      default:                 return action.actionType;
    }
  }

  // Uses Date.now(), so only render after mount — SSR text would drift from the client.
  function timeUntil(expiresAt: string | null): string {
    if (!expiresAt) return '';
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return t('timeExpired');
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return t('timeLeftDaysHours', { days, hours });
    return t('timeLeftHours', { hours });
  }

  const typeLabel = t(`actionType.${action.actionType}`);

  return (
    <article className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <StatusChip tone="teal">{typeLabel}</StatusChip>
          <p className="text-sm text-foreground">{describePayload()}</p>
          <p className="text-xs text-gold-muted">
            {t('drafted')} {mounted ? new Date(action.parentDraftedAt).toLocaleString(localeTag) : '—'}
            {mounted && timeUntil(action.expiresAt) ? ` · ${timeUntil(action.expiresAt)}` : ''}
          </p>
        </div>
        <StatusChip tone={STATUS_TONE[action.status] ?? 'neutral'} className="shrink-0 uppercase tracking-wide">
          {t(`statusLabel.${action.status}`)}
        </StatusChip>
      </div>

      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}

      {isPending && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => handle('approve')}
            className="rounded-lg bg-primary text-primary-foreground px-4 h-10 text-sm hover:opacity-95 disabled:opacity-60"
          >
            {t('approve')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handle('reject')}
            className="rounded-lg border border-destructive/40 text-destructive px-4 h-10 text-sm hover:bg-destructive/5 disabled:opacity-60"
          >
            {t('reject')}
          </button>
        </div>
      )}
    </article>
  );
}
