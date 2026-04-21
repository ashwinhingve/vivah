'use client';

import Image from 'next/image';
import { Bookmark, Send, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PhotoFallback } from '@/components/shared';
import { resolvePhotoUrl } from '@/lib/photo';

interface MatchCardProps {
  id: string;
  name: string;
  age: number | null;
  city: string;
  occupation?: string;
  primaryPhotoUrl?: string;
  compatibilityPct?: number;
  isVerified?: boolean;
  gunaPending?: boolean;
  onSendInterest?: (id: string) => void;
  onBookmark?: (id: string) => void;
  skeleton?: false;
}

interface MatchCardSkeletonProps {
  skeleton: true;
}

type Props = MatchCardProps | MatchCardSkeletonProps;

function getCompatBadgeClasses(pct: number): string {
  if (pct >= 90) return 'bg-success text-white';
  if (pct >= 70) return 'bg-teal text-white';
  if (pct >= 50) return 'bg-warning text-white';
  return 'bg-muted text-muted-foreground';
}

export function MatchCard(props: Props) {
  if ('skeleton' in props && props.skeleton) {
    return (
      <Card className="overflow-hidden">
        <Skeleton className="aspect-[4/3] rounded-none" />
        <div className="space-y-2 p-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 w-11 rounded-lg" />
          </div>
        </div>
      </Card>
    );
  }

  const {
    id,
    name,
    age,
    city,
    occupation,
    primaryPhotoUrl,
    compatibilityPct,
    isVerified,
    gunaPending,
    onSendInterest,
    onBookmark,
  } = props;
  const ageLabel = age != null && age > 0 ? `, ${age}` : '';
  const photoUrl = resolvePhotoUrl(primaryPhotoUrl);

  return (
    <Card className="group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
      <a href={`/profiles/${id}`} className="relative block aspect-[4/3]">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`${name}'s profile photo`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <PhotoFallback name={name} />
        )}

        {/* Gold inner frame */}
        <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold/70" aria-hidden="true" />

        {/* Name overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pb-2 pt-8">
          <p className="truncate font-heading text-sm font-semibold leading-tight text-white drop-shadow-sm">
            {name}
            {ageLabel ? <span className="font-normal text-white/90">{ageLabel}</span> : null}
          </p>
          <p className="truncate text-xs text-white/80">{city}</p>
        </div>

        {isVerified ? (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-success shadow-md ring-2 ring-surface/60">
            <CheckCircle2 className="h-3.5 w-3.5 text-white" aria-hidden="true" />
          </span>
        ) : null}

        {compatibilityPct != null ? (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold shadow-sm ${getCompatBadgeClasses(compatibilityPct)}`}
          >
            {compatibilityPct}% match
          </span>
        ) : null}

        {gunaPending ? (
          <div className="absolute inset-x-2 bottom-14 rounded-md bg-surface/90 px-2 py-1 text-center text-[10px] font-medium text-primary shadow-sm backdrop-blur-sm">
            Add horoscope to see Guna score
          </div>
        ) : null}
      </a>

      <div className="p-3">
        {occupation ? <p className="mb-2 truncate text-xs text-muted-foreground">{occupation}</p> : null}
        <div className="flex gap-2">
          <Button type="button" className="flex-1" onClick={() => onSendInterest?.(id)}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Send Interest
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Bookmark profile"
            onClick={() => onBookmark?.(id)}
          >
            <Bookmark className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
