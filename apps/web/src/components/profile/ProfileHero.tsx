import Image from 'next/image';
import { Users, User, UserPlus, CheckCircle2, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PhotoFallback } from '@/components/shared';
import { resolvePhotoUrl } from '@/lib/photo';
import { cn } from '@/lib/utils';
import { ManglikChip } from './ManglikChip';
import { LastActiveBadge } from './LastActiveBadge';
import { DistancePill } from './DistancePill';
import { WhyMatchPanel } from './WhyMatchPanel';
import type { MatchExplainer } from '@smartshaadi/types';

interface ProfileHeroProps {
  name: string;
  age: number | null;
  city: string;
  occupation?: string;
  primaryPhotoUrl?: string;
  isVerified?: boolean;
  completeness: number;
  createdByRole?: 'SELF' | 'PARENT' | 'SIBLING' | 'RELATIVE';
  premiumTier?: string;
  manglik?: 'YES' | 'NO' | 'PARTIAL' | null;
  lastActiveAt?: string | null;
  showsPreciseLastActive?: boolean;
  explainer?: MatchExplainer | null;
  viewerTier?: 'FREE' | 'STANDARD' | 'PREMIUM';
  distanceKm?: number | null;
}

const ROLE_CONFIG: Record<
  NonNullable<ProfileHeroProps['createdByRole']>,
  { label: string; icon: typeof Users; classes: string }
> = {
  SELF:     { label: 'Profile by Self',     icon: User,     classes: 'bg-muted text-muted-foreground' },
  PARENT:   { label: 'Profile by Parent',   icon: Users,    classes: 'bg-primary/10 text-primary' },
  SIBLING:  { label: 'Profile by Sibling',  icon: Users,    classes: 'bg-primary/10 text-primary' },
  RELATIVE: { label: 'Profile by Relative', icon: UserPlus, classes: 'bg-primary/10 text-primary' },
};

function getCompletenessTone(pct: number): { bar: string; text: string } {
  if (pct < 30) return { bar: 'from-destructive to-warning', text: 'text-destructive' };
  if (pct < 60) return { bar: 'from-warning to-gold',        text: 'text-warning' };
  return { bar: 'from-gold to-teal', text: 'text-teal' };
}

export function ProfileHero({
  name,
  age,
  city,
  occupation,
  primaryPhotoUrl,
  isVerified = false,
  completeness,
  createdByRole = 'SELF',
  premiumTier,
  manglik,
  lastActiveAt,
  showsPreciseLastActive = false,
  explainer,
  viewerTier = 'FREE',
  distanceKm,
}: ProfileHeroProps) {
  const role = ROLE_CONFIG[createdByRole];
  const RoleIcon = role.icon;
  const tone = getCompletenessTone(completeness);
  const photoUrl = resolvePhotoUrl(primaryPhotoUrl);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`${name}'s profile photo`}
            fill
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 640px"
            className="object-cover"
          />
        ) : (
          <PhotoFallback name={name} />
        )}

        <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold/70" aria-hidden="true" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-4 pb-4 pt-12">
          <h1 className="truncate font-heading text-2xl font-semibold leading-tight text-white drop-shadow-sm">
            {name}
          </h1>
          <p className="mt-0.5 truncate text-sm text-white/85">
            {age != null ? `${age} yrs` : 'Age not set'}
            {city ? ` · ${city}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ManglikChip manglik={manglik} size="xs" />
            <DistancePill distanceKm={distanceKm ?? null} fallbackCity={null} />
            <LastActiveBadge lastActiveAt={lastActiveAt} showPrecise={showsPreciseLastActive} />
          </div>
        </div>

        {isVerified ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-white shadow-md ring-2 ring-surface/40">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Verified
          </span>
        ) : null}

        {premiumTier && premiumTier !== 'FREE' ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-gold bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-muted shadow-sm backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {premiumTier}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          {occupation ? (
            <p className="truncate text-sm text-muted-foreground">{occupation}</p>
          ) : (
            <span className="text-sm italic text-muted-foreground/70">No occupation set</span>
          )}
          <Badge variant="default" className={cn('shrink-0 gap-1', role.classes)}>
            <RoleIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {role.label}
          </Badge>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Profile <span className="font-bold text-foreground">{completeness}%</span> complete
            </span>
            {completeness < 60 ? (
              <span className={cn('text-xs font-semibold', tone.text)}>Add more details →</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Looking great
              </span>
            )}
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-border-light">
            <div
              className={cn('relative h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out', tone.bar)}
              style={{ width: `${Math.max(2, completeness)}%` }}
            >
              {completeness > 0 && completeness < 100 ? (
                <span className="stripe-progress absolute inset-0" aria-hidden="true" />
              ) : null}
            </div>
          </div>
        </div>

        {explainer ? (
          <WhyMatchPanel explainer={explainer} tier={viewerTier} />
        ) : null}
      </div>
    </Card>
  );
}
