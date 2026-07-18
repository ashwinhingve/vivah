'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarHeart, Sparkles, Check, X, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { VirtualDate, VirtualDateStatus, IcebreakerSet } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  matchId: string;
  /** Current user's profiles.id — decides proposer vs invitee for feedback UI. */
  currentProfileId: string | null;
}

function getStatusLabel(status: VirtualDateStatus, t: (key: string) => string): string {
  const labels: Record<VirtualDateStatus, string> = {
    PROPOSED: t('virtualDates.status.PROPOSED'),
    CONFIRMED: t('virtualDates.status.CONFIRMED'),
    COMPLETED: t('virtualDates.status.COMPLETED'),
    CANCELLED: t('virtualDates.status.CANCELLED'),
    NO_SHOW: t('virtualDates.status.NO_SHOW'),
  };
  return labels[status];
}

const STATUS_TONE: Record<VirtualDateStatus, string> = {
  PROPOSED: 'bg-gold/15 text-gold-muted',
  CONFIRMED: 'bg-teal/15 text-teal',
  COMPLETED: 'bg-success/10 text-success',
  CANCELLED: 'bg-surface-muted text-muted-foreground',
  NO_SHOW: 'bg-surface-muted text-muted-foreground',
};

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    const json = (await res.json()) as { success: boolean; data?: T; error?: { message: string } };
    if (!res.ok || !json.success) return { ok: false, error: json.error?.message ?? 'Request failed' };
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function VirtualDates({ matchId, currentProfileId }: Props) {
  const t = useTranslations();
  const [dates, setDates] = React.useState<VirtualDate[]>([]);
  const [sets, setSets] = React.useState<IcebreakerSet[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Schedule form
  const [when, setWhen] = React.useState('');
  const [durationMin, setDurationMin] = React.useState(30);
  const [setKey, setSetKey] = React.useState('');

  const load = React.useCallback(async () => {
    const [d, ib] = await Promise.all([
      api<VirtualDate[]>(`/api/v1/video/dates/${matchId}`),
      api<IcebreakerSet[]>(`/api/v1/video/icebreakers`),
    ]);
    if (d.ok && d.data) setDates(d.data);
    else setError(d.error ?? 'Could not load dates');
    if (ib.ok && ib.data) setSets(ib.data);
    setLoading(false);
  }, [matchId]);

  React.useEffect(() => { void load(); }, [load]);

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    if (!when) return;
    setBusy(true);
    setError(null);
    const res = await api<VirtualDate>(`/api/v1/video/meetings`, {
      method: 'POST',
      body: JSON.stringify({
        matchId,
        scheduledAt: new Date(when).toISOString(),
        durationMin,
        ...(setKey ? { icebreakerSetKey: setKey } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Could not schedule'); return; }
    setWhen(''); setSetKey('');
    await load();
  }

  async function respond(dateId: string, status: 'CONFIRMED' | 'CANCELLED') {
    setBusy(true);
    await api(`/api/v1/video/meetings/${matchId}/${dateId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    await load();
  }

  async function sendFeedback(dateId: string, rating: number, cont: boolean) {
    setBusy(true);
    await api(`/api/v1/video/dates/${dateId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating, continue: cont }),
    });
    setBusy(false);
    await load();
  }

  const minWhen = new Date(Date.now() + 6 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <section className="border-b border-gold/20 bg-surface px-4 py-4 sm:px-6">
      <div className="mb-3 flex items-center gap-2">
        <CalendarHeart className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-base font-semibold text-primary">{t('virtualDates.title')}</h2>
      </div>

      {/* Schedule form */}
      <form onSubmit={schedule} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-end">
        <label className="flex flex-col text-xs text-muted-foreground">
          {t('virtualDates.schedule.when')}
          <input
            type="datetime-local"
            value={when}
            min={minWhen}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1 h-11 rounded-lg border border-gold/40 bg-background px-3 text-sm text-foreground"
            required
          />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          {t('virtualDates.schedule.duration')}
          <select
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="mt-1 h-11 rounded-lg border border-gold/40 bg-background px-3 text-sm text-foreground"
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          {t('virtualDates.schedule.icebreakers')}
          <select
            value={setKey}
            onChange={(e) => setSetKey(e.target.value)}
            className="mt-1 h-11 rounded-lg border border-gold/40 bg-background px-3 text-sm text-foreground"
          >
            <option value="">{t('virtualDates.schedule.noneOption')}</option>
            {sets.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="default" size="lg" loading={busy} className="w-full">
          {t('virtualDates.schedule.proposeDateButton')}
        </Button>
      </form>

      {error ? (
        <p className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Date list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : dates.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-4 py-6 text-center text-sm text-muted-foreground">
          {t('virtualDates.empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {dates.map((d) => {
            const isProposer = d.proposedBy === currentProfileId;
            const myRating = isProposer ? d.proposerRating : d.inviteeRating;
            const iAmInvitee = currentProfileId !== null && !isProposer;
            const promptSet = sets.find((s) => s.key === d.icebreakerSetKey);
            return (
              <li key={d.id} className="rounded-2xl border border-gold/20 bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{fmt(d.scheduledAt)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[d.status]}`}>
                    {getStatusLabel(d.status, t)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{d.durationMin} min</p>

                {promptSet ? (
                  <div className="mt-2 rounded-lg bg-surface-muted p-2">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-teal">
                      <Sparkles className="h-3.5 w-3.5" /> {promptSet.label}
                    </p>
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {promptSet.prompts.slice(0, 3).map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  </div>
                ) : null}

                {/* Invitee responds to a proposal */}
                {d.status === 'PROPOSED' && iAmInvitee ? (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="default" loading={busy} onClick={() => respond(d.id, 'CONFIRMED')}>
                      <Check className="mr-1 h-4 w-4" /> {t('virtualDates.actions.accept')}
                    </Button>
                    <Button size="sm" variant="outline" loading={busy} onClick={() => respond(d.id, 'CANCELLED')}>
                      <X className="mr-1 h-4 w-4" /> {t('virtualDates.actions.decline')}
                    </Button>
                  </div>
                ) : null}

                {/* Post-date feedback on a confirmed date */}
                {d.status === 'CONFIRMED' && myRating === null ? (
                  <FeedbackForm busy={busy} onSubmit={(r, c) => sendFeedback(d.id, r, c)} t={t} />
                ) : null}

                {d.status === 'CONFIRMED' && myRating !== null ? (
                  <p className="mt-2 text-xs text-teal">{t('virtualDates.feedback.thanksWaiting')}</p>
                ) : null}

                {d.status === 'COMPLETED' ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-success">
                    {d.proposerContinue && d.inviteeContinue ? (
                      <>
                        {t('virtualDates.feedback.completed')}
                        <Heart className="h-3 w-3 text-primary" aria-hidden="true" />
                      </>
                    ) : (
                      t('virtualDates.feedback.completedFeedbackOnly')
                    )}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FeedbackForm({
  busy,
  onSubmit,
  t,
}: {
  busy: boolean;
  onSubmit: (rating: number, cont: boolean) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [rating, setRating] = React.useState(0);
  const [cont, setCont] = React.useState(true);
  return (
    <div className="mt-3 rounded-lg bg-surface-muted p-2">
      <p className="mb-1 text-xs font-semibold text-foreground">{t('virtualDates.feedback.howDidItGo')}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={t('virtualDates.feedback.starRating', { count: n })}
            onClick={() => setRating(n)}
            className={`h-8 w-8 rounded-full text-sm font-semibold ${
              n <= rating ? 'bg-gold/30 text-gold-muted' : 'bg-background text-muted-foreground'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={cont} onChange={(e) => setCont(e.target.checked)} />
        {t('virtualDates.feedback.continueCheckbox')}
      </label>
      <Button
        size="sm"
        variant="default"
        loading={busy}
        disabled={rating === 0}
        className="mt-2"
        onClick={() => onSubmit(rating, cont)}
      >
        {t('virtualDates.feedback.submitButton')}
      </Button>
    </div>
  );
}
