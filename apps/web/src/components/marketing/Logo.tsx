type LogoProps = {
  size?: number;
  className?: string;
};

function MandapSvg({
  size = 32,
  className,
  stroke,
  fillPrimary,
  fillGold,
  fillTeal,
}: LogoProps & {
  stroke: string;
  fillPrimary: string;
  fillGold: string;
  fillTeal: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Smart Shaadi"
      className={className}
    >
      <title>Smart Shaadi</title>
      {/* Base platform */}
      <rect x="4" y="26" width="24" height="3" rx="1" fill={fillPrimary} />
      {/* Pillars */}
      <rect x="6" y="12" width="3" height="14" rx="1" fill={fillPrimary} />
      <rect x="23" y="12" width="3" height="14" rx="1" fill={fillPrimary} />
      {/* Arch */}
      <path
        d="M6 12 Q 16 2 26 12"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Decorative dots on arch */}
      <circle cx="11" cy="7" r="1" fill={fillGold} />
      <circle cx="21" cy="7" r="1" fill={fillGold} />
      {/* Diya base (gold flame body) */}
      <path
        d="M14 16 Q 16 13.5 18 16 Q 17 17 16 17 Q 15 17 14 16 Z"
        fill={fillGold}
      />
      {/* Teardrop flame tip */}
      <path d="M16 10 Q 17.5 12 16 14 Q 14.5 12 16 10 Z" fill={fillPrimary} />
      {/* Teal dot at flame base */}
      <circle cx="16" cy="16.5" r="0.9" fill={fillTeal} />
    </svg>
  );
}

export function LogoMark({ size = 32, className }: LogoProps) {
  return (
    <MandapSvg
      size={size}
      className={className}
      stroke="#7B2D42"
      fillPrimary="#7B2D42"
      fillGold="#C5A47E"
      fillTeal="#0E7C7B"
    />
  );
}

export function LogoFull({ size = 32, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center ${className ?? ''}`}>
      <LogoMark size={size} />
      <span className="ml-2.5 text-xl font-semibold text-[#7B2D42] font-[family-name:var(--font-heading)]">
        Smart Shaadi
      </span>
    </span>
  );
}

export function LogoWhite({ size = 32, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center ${className ?? ''}`}>
      <MandapSvg
        size={size}
        stroke="#FFFFFF"
        fillPrimary="#FFFFFF"
        fillGold="#FFFFFF"
        fillTeal="#FFFFFF"
      />
      <span className="ml-2.5 text-xl font-semibold text-white font-[family-name:var(--font-heading)]">
        Smart Shaadi
      </span>
    </span>
  );
}
