import type { ViewStyle } from 'react-native';

/**
 * Warm, burgundy-tinted shadows — the web design system never uses gray-black
 * shadows (`--shadow-card` is rgba(123,45,66,…)). NativeWind can't express
 * cross-platform colored shadows, so these are plain style objects to spread
 * into `style`. iOS reads the shadow* props; Android reads `elevation` and
 * tints it with `shadowColor` (API 28+).
 */
const SHADOW_TINT = '#7B2D42';

/** Resting card lift — subtle. */
export const shadowWarm: ViewStyle = {
  shadowColor: SHADOW_TINT,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
};

/** Floating chrome (tab bar, toasts, sticky action bars) — pronounced. */
export const shadowWarmLg: ViewStyle = {
  shadowColor: SHADOW_TINT,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.16,
  shadowRadius: 16,
  elevation: 6,
};

/** Gold halo for premium/featured surfaces (web --shadow-gold-glow). */
export const shadowGoldGlow: ViewStyle = {
  shadowColor: '#C5A47E',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.28,
  shadowRadius: 12,
  elevation: 4,
};
