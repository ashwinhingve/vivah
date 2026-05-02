'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  Sparkles, Star, CheckCircle2, Heart, EyeOff, Bookmark, BookmarkCheck, Loader2,
} from 'lucide-react';
import type { MatchFeedItem } from '@smartshaadi/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhotoFallback } from '@/components/shared';
import { resolvePhotoUrl } from '@/lib/photo';
import { ManglikChip } from '@/components/profile/ManglikChip';
import { LastActiveBadge } from '@/components/profile/LastActiveBadge';
import { DistancePill } from '@/components/profile/DistancePill';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type Tier = MatchFeedItem['compatibility']['tier'];

const TIER_CONFIG: Record<
  Tier,
  { label: string; icon: typeof Sparkles; classes: string }
> = {
  excellent: { label: 'Excellent', icon: Sparkles,     classes: 'bg-teal text-white shadow-sm ring-1 ring-teal/30' },
  good:      { label: 'Good',      icon: CheckCircle2, classes: 'bg-success text-white shadow-sm ring-1 ring-success/30' },
  average:   { label: 'Average',   icon: Star,         classes: 'bg-warning text-white shadow-sm' },
  low:       { label: 'Low',       icon: Star,         classes: 'bg-muted text-muted-foreground' },
};

type InterestStatus = 'idle' | 'sending' | 'sent' | 'error';
type ShortlistStatus = 'idle' | 'saving' | 'error';

interface MatchCardProps {
  match: MatchFeedItem;
}

export function MatchCard({ match }: MatchCardProps) {
  const tier = TIER_CONFIG[match.compatibility.tier];
  const TierIcon = tier.icon;
  const photoUrl = match.photoHidden ? null : resolvePhotoUrl(match.photoKey);

  const [interestStatus, setInterestStatus] = useState<InterestStatus>('idle');
  const [interestError, setInterestError] = useState<string | null>(null);
  const [shortlisted, setShortlisted] = useState<boolean>(match.shortlisted);
  const [shortlistStatus, setShortlistStatus] = useState<ShortlistStatus>('idle');

  async function sendInterest() {
    setInterestStatus('sending');
    setInterestError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/requests`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ receiverId: match.profileId }),
        credentials: 'include',
      });
      if (res.status === 409 || res.ok) {
        setInterestStatus('sent');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setInterestError(body.error ?? 'Could not send interest');
      setInterestStatus('error');
    } catch {
      setInterestError('Network error');
      setInterestStatus('error');
    }
  }

  async function toggleShortlist() {
    const next = !shortlisted;
    setShortlisted(next);
    setShortlistStatus('saving');
    try {
      const res = await fetch(
        `${API_URL}/api/v1/matchmaking/shortlists/${match.profileId}`,
        { method: next ? 'POST' : 'DELETE', credentials: 'include' },
      );
      if (!res.ok && res.status !== 409) {
        setShortlisted(!next); // rollback
        setShortlistStatus('error');
        return;
      }
      setShortlistStatus('idle');
    } catch {
      setShortlisted(!next);
      setShortlistStatus('error');
    }
  }

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] focus-within:-translate-y-0.5 focus-within:shadow-[var(--shadow-card-hover)]">
      <Link href={`/profiles/${match.profileId}`} className="relative block aspect-[4/5] w-full overflow-hidden">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`${match.name}'s profile photo`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : match.photoHidden ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-teal/10 to-gold/10 p-4 text-center">
            <EyeOff className="h-8 w-8 text-primary/60" aria-hidden="true" />
            <PhotoFallback name={match.name} />
            <p className="max-w-[15ch] text-[11px] font-medium leading-tight text-primary/80">
              Photo hidden — request to view
            </p>
          </div>
        ) : (
          <PhotoFallback name={match.name} />
        )}

        <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold/70" aria-hidden="true" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-3 pt-12">
          <h3 className="font-heading text-lg font-semibold leading-tight text-white drop-shadow-sm">
            {match.name}
            {match.age != null ? <span className="font-normal text-white/90">, {match.age}</span> : null}
          </h3>
          <p className="text-xs text-white/80">{match.city}</p>
        </div>

        {match.isNew ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-md">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            New
          </span>
        ) : null}

        {match.isVerified ? (
          <span
            className="absolute right-3 top-12 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-[10px] font-bold text-success shadow-sm backdrop-blur-sm"
            title="Aadhaar verified · Photo checked"
          >
            <CheckCircle2 className="h-3 w-3 fill-success text-white" aria-hidden="true" />
            Verified
          </span>
        ) : null}

        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-bold text-primary shadow-md backdrop-blur-sm">
          <Heart className="h-3 w-3 fill-current text-teal" aria-hidden="true" />
          {match.compatibility.totalScore}%
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tier.classes}`}>
            <TierIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {tier.label}
          </span>
          <Badge variant="gold" aria-label={`${match.compatibility.gunaScore} of 36 Guna matched`}>
            {match.compatibility.gunaScore}/36 Guna
          </Badge>
          <ManglikChip manglik={match.manglik} size="xs" />
          <DistancePill distanceKm={match.distanceKm ?? null} fallbackCity={match.city ?? null} />
          {match.isBoosted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Boosted
            </span>
          ) : null}
          <LastActiveBadge lastActiveAt={match.lastActiveAt} showPrecise={match.premiumTier !== 'FREE'} />
        </div>

        {match.explainer?.reasons[0] ? (
          <p className="line-clamp-1 text-[12px] text-slate-600">
            {match.explainer.reasons[0]}
          </p>
        ) : null}

        <div className="mt-auto flex gap-2 pt-1">
          <Button
            type="button"
            className="flex-1"
            size="default"
            onClick={sendInterest}
            disabled={interestStatus === 'sending' || interestStatus === 'sent'}
            variant={interestStatus === 'sent' ? 'ghost' : 'default'}
          >
            {interestStatus === 'sending' ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Sending…</>
            ) : interestStatus === 'sent' ? (
              <><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Interest Sent</>
            ) : (
              <><Heart className="h-4 w-4" aria-hidden="true" />Send Interest</>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
            aria-pressed={shortlisted}
            onClick={toggleShortlist}
            disabled={shortlistStatus === 'saving'}
          >
            {shortlistStatus === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : shortlisted ? (
              <BookmarkCheck className="h-4 w-4 fill-current text-gold" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        {interestError ? (
          <p role="alert" className="text-center text-xs text-destructive">{interestError}</p>
        ) : null}

        <Link
          href={`/profiles/${match.profileId}`}
          className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-teal underline-offset-4 transition-colors hover:text-teal-hover hover:underline"
        >
          View full profile
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </Card>
  );
}
