import Link from 'next/link';
import Image from 'next/image';
import type { MatchRequest, ProfileDetailResponse } from '@smartshaadi/types';
import { fetchAuth } from '@/lib/server-fetch';
import { resolvePhotoUrl } from '@/lib/photo';
import { ManglikChip } from '@/components/profile/ManglikChip';
import { LastActiveBadge } from '@/components/profile/LastActiveBadge';

interface Props {
  request: MatchRequest;
  perspective: 'received' | 'sent';
}

export async function AcceptedMatchCard({ request, perspective }: Props) {
  const otherId = perspective === 'received' ? request.senderId : request.receiverId;
  const profile = await fetchAuth<ProfileDetailResponse>(`/api/v1/profiles/${otherId}`);
  const acceptedOn = new Date(request.updatedAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const name = profile?.personal?.fullName ?? `Profile #${otherId.slice(0, 8).toUpperCase()}`;
  const dob = profile?.personal?.dob;
  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  const city = profile?.location?.city ?? '';
  const primaryPhoto = profile?.photos.find((p) => p.isPrimary) ?? profile?.photos[0];
  const photoUrl = resolvePhotoUrl(primaryPhoto?.r2Key);

  return (
    <div className="bg-surface rounded-xl border border-border shadow-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 bg-primary/10">
          {photoUrl ? (
            <Image src={photoUrl} alt={name} fill sizes="56px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">
              {name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {name}{age != null ? <span className="font-normal text-muted-foreground">, {age}</span> : null}
          </p>
          {city ? <p className="text-xs text-muted-foreground truncate">{city}</p> : null}
          <p className="text-xs text-muted-foreground">Matched on {acceptedOn}</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
          Matched
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ManglikChip manglik={profile?.horoscope?.manglik ?? null} size="xs" />
        <LastActiveBadge lastActiveAt={profile?.lastActiveAt ?? null} showPrecise />
      </div>

      {request.message && (
        <p className="text-xs text-muted-foreground italic line-clamp-2 border-l-2 border-gold pl-2">
          &ldquo;{request.message}&rdquo;
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Link
          href={`/profiles/${otherId}`}
          className="flex-1 text-center rounded-lg border border-teal text-teal text-xs font-semibold py-2 min-h-[36px] flex items-center justify-center hover:bg-teal/5 transition-colors"
        >
          View Profile
        </Link>
        <Link
          href={`/chat/${request.id}`}
          className="flex-1 text-center rounded-lg bg-teal text-white text-xs font-semibold py-2 min-h-[36px] flex items-center justify-center hover:bg-teal-hover transition-colors"
        >
          Open Chat
        </Link>
      </div>

      <Link
        href={`/matches/${request.id}/compatibility`}
        className="text-xs text-teal hover:underline self-start"
      >
        View compatibility analysis →
      </Link>
    </div>
  );
}
