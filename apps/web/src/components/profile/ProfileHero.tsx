interface ProfileHeroProps {
  name: string;
  age: number;
  city: string;
  occupation?: string;
  primaryPhotoUrl?: string;
  isVerified?: boolean;
  completeness: number;
  createdByRole?: 'SELF' | 'PARENT' | 'SIBLING' | 'RELATIVE';
  premiumTier?: string;
}

const ROLE_LABELS: Record<string, string> = {
  SELF: 'Profile by Self',
  PARENT: 'Profile by Parent',
  SIBLING: 'Profile by Sibling',
  RELATIVE: 'Profile by Relative',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getCompletenessColor(pct: number): string {
  if (pct < 30) return '#DC2626';
  if (pct < 60) return '#D97706';
  return '#0E7C7B';
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
}: ProfileHeroProps) {
  const initials = getInitials(name);
  const roleLabel = ROLE_LABELS[createdByRole] ?? 'Profile by Self';
  const completenessColor = getCompletenessColor(completeness);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] overflow-hidden">
      {/* Photo */}
      <div className="relative aspect-[4/3]">
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
            <span
              className="text-4xl font-semibold text-white"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              {initials}
            </span>
          </div>
        )}

        {/* Gold frame overlay */}
        <div className="absolute inset-0 rounded-t-xl border-2 border-[#C5A47E] pointer-events-none" />

        {/* Bottom gradient + name overlay */}
        <div
          className="absolute bottom-0 left-0 right-0 px-4 pt-8 pb-3"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)' }}
        >
          <p
            className="text-white text-lg font-semibold leading-tight truncate"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {name}
          </p>
          <p className="text-white/80 text-sm mt-0.5 truncate">
            {age} yrs · {city}
          </p>
        </div>

        {/* Verified badge — top right */}
        {isVerified && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-[#059669] px-2.5 py-1 shadow">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 4.97 3.03 9.254 7.5 11.25A11.955 11.955 0 0021 12c0-2.196-.608-4.25-1.663-5.974A11.96 11.96 0 0012 2.964z" />
            </svg>
            <span className="text-white text-xs font-semibold">Verified</span>
          </div>
        )}

        {/* Premium tier badge — top left */}
        {premiumTier && premiumTier !== 'FREE' && (
          <div className="absolute top-3 left-3 rounded-full bg-[#FFF3E0] border border-[#FDE68A] px-2.5 py-1">
            <span className="text-[#D97706] text-xs font-semibold">{premiumTier}</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-4 py-3 space-y-3">
        {/* Occupation + trust badge row */}
        <div className="flex items-center justify-between gap-2">
          {occupation && (
            <p className="text-sm text-[#6B6B76] truncate">{occupation}</p>
          )}
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: 'rgba(123,45,66,0.08)', color: '#7B2D42' }}
          >
            {roleLabel}
          </span>
        </div>

        {/* Completeness bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#6B6B76]">Profile {completeness}% complete</span>
            {completeness < 60 && (
              <span className="text-xs font-medium" style={{ color: completenessColor }}>
                Add more details →
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-[#F0EBE4] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${completeness}%`,
                background: `linear-gradient(to right, #C5A47E, ${completenessColor})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
