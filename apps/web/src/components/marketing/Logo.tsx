type LogoProps = {
  size?: number;
  className?: string;
};

/**
 * Brand badge — inline copy of `src/app/icon.svg` (the favicon) so the page
 * logo and browser icon are the same mark. Colors come from theme tokens.
 */
function BadgeSvg({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Smart Shaadi"
      className={className}
    >
      <title>Smart Shaadi</title>
      {/* Burgundy tile */}
      <rect width="32" height="32" rx="7" fill="var(--color-primary)" />
      {/* Mandap arch */}
      <path
        d="M6.5 14 Q16 4.5 25.5 14"
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="10.4" cy="8.4" r="0.9" fill="var(--color-gold-light)" />
      <circle cx="21.6" cy="8.4" r="0.9" fill="var(--color-gold-light)" />
      {/* Pillars + base */}
      <rect x="5.3" y="13.4" width="2.5" height="9" rx="1.25" fill="var(--color-gold)" />
      <rect x="24.2" y="13.4" width="2.5" height="9" rx="1.25" fill="var(--color-gold)" />
      <rect x="4.5" y="21.6" width="23" height="2.6" rx="1.3" fill="var(--color-gold)" />
      {/* Garland swag */}
      <path d="M11.7 18.6 C 12.9 21.4, 19.1 21.4, 20.3 18.6 Z" fill="var(--color-gold)" />
      {/* Flame / heart */}
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

export function LogoMark({ size = 32, className }: LogoProps) {
  return <BadgeSvg size={size} className={className} />;
}

export function LogoFull({ size = 32, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center ${className ?? ''}`}>
      <BadgeSvg size={size} />
      <span className="ml-2.5 text-xl font-semibold text-primary font-heading">
        Smart Shaadi
      </span>
    </span>
  );
}

export function LogoWhite({ size = 32, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center ${className ?? ''}`}>
      <BadgeSvg size={size} />
      <span className="ml-2.5 text-xl font-semibold text-white font-heading">
        Smart Shaadi
      </span>
    </span>
  );
}
