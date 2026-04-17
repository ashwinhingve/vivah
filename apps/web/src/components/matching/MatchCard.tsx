interface MatchCardProps {
  id: string;
  name: string;
  age: number;
  city: string;
  occupation?: string;
  primaryPhotoUrl?: string;
  compatibilityPct?: number;
  isVerified?: boolean;
  onSendInterest?: (id: string) => void;
  onBookmark?: (id: string) => void;
  skeleton?: false;
}

interface MatchCardSkeletonProps {
  skeleton: true;
}

type Props = MatchCardProps | MatchCardSkeletonProps;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getCompatibilityColor(pct: number): string {
  if (pct >= 90) return '#059669';
  if (pct >= 70) return '#0E7C7B';
  if (pct >= 50) return '#D97706';
  return '#6B6B76';
}

export function MatchCard(props: Props) {
  if ('skeleton' in props && props.skeleton) {
    return (
      <div className="rounded-xl border border-[#E8E0D8] bg-white overflow-hidden">
        <div className="aspect-[4/3] bg-gradient-to-br from-[#E8E0D8] to-[#F0EBE4] animate-pulse" />
        <div className="p-3 space-y-2">
          <div className="h-4 w-2/3 rounded bg-[#E8E0D8] animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-[#F0EBE4] animate-pulse" />
          <div className="flex gap-2 mt-2">
            <div className="h-9 flex-1 rounded-lg bg-[#F0EBE4] animate-pulse" />
            <div className="h-9 w-9 rounded-lg bg-[#F0EBE4] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const { id, name, age, city, occupation, primaryPhotoUrl, compatibilityPct, isVerified, onSendInterest, onBookmark } = props;
  const initials = getInitials(name);
  const compatColor = compatibilityPct != null ? getCompatibilityColor(compatibilityPct) : undefined;

  return (
    <div className="rounded-xl border border-[#E8E0D8] bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Photo */}
      <a href={`/profiles/${id}`} className="block relative aspect-[4/3]">
        {primaryPhotoUrl ? (
          <img
            src={primaryPhotoUrl}
            alt={`${name}'s profile photo`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7B2D42 0%, #C5A47E 100%)' }}
          >
            <span className="text-3xl font-semibold text-white font-heading">
              {initials}
            </span>
          </div>
        )}

        {/* Gold frame */}
        <div className="absolute inset-0 border-2 border-[#C5A47E] pointer-events-none" />

        {/* Bottom gradient + info */}
        <div
          className="absolute bottom-0 left-0 right-0 px-3 pt-6 pb-2"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
        >
          <p className="text-white text-sm font-semibold leading-tight truncate font-heading">
            {name}, {age}
          </p>
          <p className="text-white/75 text-xs truncate">{city}</p>
        </div>

        {/* Verified badge */}
        {isVerified && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center shadow">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Compatibility chip */}
        {compatibilityPct != null && (
          <div
            className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold shadow"
            style={{ background: `${compatColor}22`, color: compatColor, border: `1px solid ${compatColor}44` }}
          >
            {compatibilityPct}% match
          </div>
        )}
      </a>

      {/* Card body */}
      <div className="p-3">
        {occupation && (
          <p className="text-xs text-[#6B6B76] truncate mb-2">{occupation}</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSendInterest?.(id)}
            className="flex-1 bg-[#0E7C7B] hover:bg-[#149998] active:scale-[0.97] text-white text-sm font-semibold rounded-lg py-2 min-h-[44px] transition-colors"
          >
            Send Interest
          </button>
          <button
            type="button"
            onClick={() => onBookmark?.(id)}
            aria-label="Bookmark profile"
            className="w-11 h-11 rounded-lg border border-[#E8E0D8] flex items-center justify-center text-[#6B6B76] hover:border-[#C5A47E] hover:text-[#C5A47E] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
