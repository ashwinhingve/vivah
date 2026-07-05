'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MatchCard } from '@/components/matching/MatchCard';
import { useToast } from '@/components/ui/toast';
import { clientEnv } from '@/lib/env';

export interface DashboardMatchItem {
  profileId: string;
  name: string;
  age: number | null;
  city: string;
  photoKey: string | null;
  compatibility?: { totalScore: number; flags: string[] };
}

/**
 * Client wrapper for the dashboard "Today's Matches" strip.
 *
 * The dashboard page is an async Server Component, so it can't hand event
 * handlers to `MatchCard`. This wraps the strip and supplies real
 * `onSendInterest` / `onBookmark` handlers backed by the matchmaking API —
 * fixing the two buttons that were previously no-ops.
 */
export function DashboardMatches({ items }: { items: DashboardMatchItem[] }) {
  const t = useTranslations('matchCard');
  const { toast } = useToast();
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const withBusy = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function sendInterest(id: string) {
    if (sent.has(id) || busy.has(id)) return;
    withBusy(id, true);
    try {
      const res = await fetch(`${clientEnv.apiUrl}/api/v1/matchmaking/requests`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: id }),
      });
      // 409 = interest already sent — treat as success.
      if (res.ok || res.status === 409) {
        setSent((prev) => new Set(prev).add(id));
        toast(t('interestSent'), 'success');
      } else {
        toast(t('couldNotSend'), 'error');
      }
    } catch {
      toast(t('networkError'), 'error');
    } finally {
      withBusy(id, false);
    }
  }

  async function toggleBookmark(id: string) {
    if (busy.has(id)) return;
    const wasSaved = saved.has(id);
    withBusy(id, true);
    // Optimistic flip.
    setSaved((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      const res = await fetch(`${clientEnv.apiUrl}/api/v1/matchmaking/shortlists/${id}`, {
        method: wasSaved ? 'DELETE' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...(wasSaved ? {} : { body: JSON.stringify({}) }),
      });
      if (!res.ok && res.status !== 409) {
        // Revert on failure.
        setSaved((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id);
          else next.delete(id);
          return next;
        });
        toast(t('couldNotSave'), 'error');
      } else {
        toast(wasSaved ? t('removed') : t('saved'), 'success');
      }
    } catch {
      setSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(id);
        else next.delete(id);
        return next;
      });
      toast(t('networkError'), 'error');
    } finally {
      withBusy(id, false);
    }
  }

  return (
    <div className="-mx-4 px-4 overflow-x-auto pb-1 sm:mx-0 sm:px-0 sm:overflow-visible">
      <div className="flex gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.profileId} className="w-44 shrink-0 sm:w-auto">
            <MatchCard
              id={item.profileId}
              name={item.name || 'Member'}
              age={item.age}
              city={item.city}
              {...(item.photoKey ? { primaryPhotoUrl: item.photoKey } : {})}
              compatibilityPct={item.compatibility?.totalScore}
              gunaPending={item.compatibility?.flags?.includes('guna_pending')}
              hideGunaHint
              interestSent={sent.has(item.profileId)}
              bookmarked={saved.has(item.profileId)}
              onSendInterest={sendInterest}
              onBookmark={toggleBookmark}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
