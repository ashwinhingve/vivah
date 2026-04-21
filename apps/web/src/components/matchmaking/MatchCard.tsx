import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Star, CheckCircle2, Heart, X } from 'lucide-react';
import type { MatchFeedItem } from '@smartshaadi/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhotoFallback } from '@/components/shared';
import { resolvePhotoUrl } from '@/lib/photo';

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

interface MatchCardProps {
  match: MatchFeedItem;
}

export function MatchCard({ match }: MatchCardProps) {
  const tier = TIER_CONFIG[match.compatibility.tier];
  const TierIcon = tier.icon;
  const photoUrl = resolvePhotoUrl(match.photoKey);

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] focus-within:-translate-y-0.5 focus-within:shadow-[var(--shadow-card-hover)]">
      {/* Photo area — aspect 4/5 for editorial feel, gold frame, gradient overlay */}
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`${match.name}'s profile photo`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <PhotoFallback name={match.name} />
        )}

        {/* Gold inner frame */}
        <div
          className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold/70"
          aria-hidden="true"
        />

        {/* Bottom gradient + name overlay (ui-component.md Step 4) */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-3 pt-12"
        >
          <h3 className="font-heading text-lg font-semibold leading-tight text-white drop-shadow-sm">
            {match.name}
            {match.age != null ? <span className="font-normal text-white/90">, {match.age}</span> : null}
          </h3>
          <p className="text-xs text-white/80">{match.city}</p>
        </div>

        {/* "New" chip — top left */}
        {match.isNew ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-md">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            New
          </span>
        ) : null}

        {/* Compat score pill — top right */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-bold text-primary shadow-md backdrop-blur-sm">
          <Heart className="h-3 w-3 fill-current text-teal" aria-hidden="true" />
          {match.compatibility.totalScore}%
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Tier + Guna chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tier.classes}`}>
            <TierIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {tier.label}
          </span>
          <Badge variant="gold" aria-label={`${match.compatibility.gunaScore} of 36 Guna matched`}>
            {match.compatibility.gunaScore}/36 Guna
          </Badge>
        </div>

        {/* Actions */}
        <div className="mt-auto flex gap-2 pt-1">
          <form action="#" className="flex-1">
            <Button type="submit" className="w-full" size="default">
              <Heart className="h-4 w-4" aria-hidden="true" />
              Accept
            </Button>
          </form>
          <form action="#" className="flex-1">
            <Button type="submit" variant="outline" className="w-full" size="default">
              <X className="h-4 w-4" aria-hidden="true" />
              Decline
            </Button>
          </form>
        </div>

        {/* View profile link */}
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
