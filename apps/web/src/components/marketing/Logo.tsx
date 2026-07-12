type LogoProps = {
  size?: number;
  className?: string;
};

/**
 * Brand badge — single source of truth for the Smart Shaadi mark. Colors come
 * from theme tokens.
 *
 * Two detail levels:
 * - **full** — mandap arch + finial dots + pillars + base + garland + two-tone
 *   flame-heart. Reads well at ≥ 28px (marketing chrome, app headers,
 *   `apple-icon.tsx` at 128px).
 * - **simplified** — drops the finial dots + garland and thickens the arch and
 *   pillars so the mark survives 16–24px (favicon, compact chrome).
 *
 * `src/app/icon.svg` mirrors the **simplified** geometry and
 * `src/app/apple-icon.tsx` mirrors the **full** geometry — both with hardcoded
 * hex (file/OG routes can't read CSS vars). Keep all three in sync when the
 * paths change.
 */
function BadgeSvg({
  size = 32,
  simplified = false,
  decorative = false,
  className,
}: LogoProps & { simplified?: boolean; decorative?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={decorative ? undefined : 'Smart Shaadi'}
      aria-hidden={decorative || undefined}
      className={className}
    >
      {!decorative && <title>Smart Shaadi</title>}
      {/* Burgundy tile */}
      <rect width="32" height="32" rx="7" fill="var(--color-primary)" />
      {/* Mandap arch */}
      <path
        d="M6.5 14 Q16 4.5 25.5 14"
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth={simplified ? 2.8 : 2.1}
        strokeLinecap="round"
      />
      {simplified ? (
        <>
          {/* Pillars + base — thickened for small sizes */}
          <rect x="4.95" y="13.4" width="3.2" height="9" rx="1.6" fill="var(--color-gold)" />
          <rect x="23.85" y="13.4" width="3.2" height="9" rx="1.6" fill="var(--color-gold)" />
          <rect x="4.5" y="21.4" width="23" height="3" rx="1.5" fill="var(--color-gold)" />
        </>
      ) : (
        <>
          {/* Finials */}
          <circle cx="10.4" cy="8.4" r="0.9" fill="var(--color-gold-light)" />
          <circle cx="21.6" cy="8.4" r="0.9" fill="var(--color-gold-light)" />
          {/* Pillars + base */}
          <rect x="5.3" y="13.4" width="2.5" height="9" rx="1.25" fill="var(--color-gold)" />
          <rect x="24.2" y="13.4" width="2.5" height="9" rx="1.25" fill="var(--color-gold)" />
          <rect x="4.5" y="21.6" width="23" height="2.6" rx="1.3" fill="var(--color-gold)" />
          {/* Garland swag */}
          <path d="M11.7 18.6 C 12.9 21.4, 19.1 21.4, 20.3 18.6 Z" fill="var(--color-gold)" />
        </>
      )}
      {/* Flame / heart — the anchor motif, kept at every size */}
      <path
        d="M16 9.4 C 19.6 12.8, 18.7 16.4, 16 18.4 C 13.3 16.4, 12.4 12.8, 16 9.4 Z"
        fill="var(--color-peach)"
      />
      <path
        d="M16 12.4 C 17.9 14.2, 17.4 16.2, 16 17.6 C 14.6 16.2, 14.1 14.2, 16 12.4 Z"
        fill="var(--color-teal)"
      />
    </svg>
  );
}

export function LogoMark({
  size = 32,
  decorative,
  className,
}: LogoProps & { decorative?: boolean }) {
  return (
    <BadgeSvg
      size={size}
      simplified={size < 28}
      decorative={decorative}
      className={className}
    />
  );
}

export function LogoFull({ size = 32, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center ${className ?? ''}`}>
      {/* decorative: the adjacent wordmark text carries the accessible name */}
      <BadgeSvg size={size} simplified={size < 28} decorative />
      <span className="ml-2.5 text-xl font-semibold text-primary font-heading">
        Smart Shaadi
      </span>
    </span>
  );
}

export function LogoWhite({ size = 32, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center ${className ?? ''}`}>
      {/* decorative: the adjacent wordmark text carries the accessible name */}
      <BadgeSvg size={size} simplified={size < 28} decorative />
      <span className="ml-2.5 text-xl font-semibold text-white font-heading">
        Smart Shaadi
      </span>
    </span>
  );
}
