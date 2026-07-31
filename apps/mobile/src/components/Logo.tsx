import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { tokens } from '@/theme/tokens';

/**
 * LogoMark — the Smart Shaadi brand badge for React Native.
 *
 * A direct port of the web `BadgeSvg` (apps/web/src/components/marketing/Logo.tsx
 * / apps/web/src/app/icon.svg): a burgundy tile holding the mandap arch, gold
 * pillars, and the peach/teal flame-heart. Geometry is on a 32×32 viewBox and
 * kept byte-for-byte in sync with the web mark so the app icon and in-app logo
 * read as one brand. Colors are hardcoded from theme tokens (SVG can't read the
 * NativeWind CSS vars).
 *
 * Two detail levels, matching web:
 * - **full** (default ≥ 28px): finial dots + garland swag.
 * - **simplified** (< 28px, or forced): drops the finials/garland and thickens
 *   the arch + pillars so it survives small sizes.
 */
interface LogoProps {
  size?: number;
  /** Force the small-size geometry regardless of `size`. */
  simplified?: boolean;
  /**
   * Hide from the a11y tree when an adjacent wordmark/text already carries the
   * "Smart Shaadi" name (mirrors the web `decorative` prop).
   */
  decorative?: boolean;
}

export function LogoMark({ size = 32, simplified, decorative = false }: LogoProps) {
  const useSimplified = simplified ?? size < 28;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      accessibilityRole={decorative ? 'none' : 'image'}
      aria-label={decorative ? undefined : 'Smart Shaadi'}
    >
      {/* Burgundy tile */}
      <Rect width="32" height="32" rx="7" fill={tokens.primary} />

      {/* Mandap arch */}
      <Path
        d="M6.5 14 Q16 4.5 25.5 14"
        fill="none"
        stroke={tokens.gold}
        strokeWidth={useSimplified ? 2.8 : 2.1}
        strokeLinecap="round"
      />

      {useSimplified ? (
        <>
          {/* Pillars + base — thickened for small sizes */}
          <Rect x="4.95" y="13.4" width="3.2" height="9" rx="1.6" fill={tokens.gold} />
          <Rect x="23.85" y="13.4" width="3.2" height="9" rx="1.6" fill={tokens.gold} />
          <Rect x="4.5" y="21.4" width="23" height="3" rx="1.5" fill={tokens.gold} />
        </>
      ) : (
        <>
          {/* Finials */}
          <Circle cx="10.4" cy="8.4" r="0.9" fill={tokens.gold} />
          <Circle cx="21.6" cy="8.4" r="0.9" fill={tokens.gold} />
          {/* Pillars + base */}
          <Rect x="5.3" y="13.4" width="2.5" height="9" rx="1.25" fill={tokens.gold} />
          <Rect x="24.2" y="13.4" width="2.5" height="9" rx="1.25" fill={tokens.gold} />
          <Rect x="4.5" y="21.6" width="23" height="2.6" rx="1.3" fill={tokens.gold} />
          {/* Garland swag */}
          <Path d="M11.7 18.6 C 12.9 21.4, 19.1 21.4, 20.3 18.6 Z" fill={tokens.gold} />
        </>
      )}

      {/* Flame / heart — the anchor motif, kept at every size */}
      <Path
        d="M16 9.4 C 19.6 12.8, 18.7 16.4, 16 18.4 C 13.3 16.4, 12.4 12.8, 16 9.4 Z"
        fill={tokens.peach}
      />
      <Path
        d="M16 12.4 C 17.9 14.2, 17.4 16.2, 16 17.6 C 14.6 16.2, 14.1 14.2, 16 12.4 Z"
        fill={tokens.teal}
      />
    </Svg>
  );
}
