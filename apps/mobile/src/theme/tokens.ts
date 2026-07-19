/**
 * Design tokens — Smart Shaadi color palette, light + dark.
 *
 * Single source of truth for JS-side colors (props that can't take a
 * className: ActivityIndicator, placeholderTextColor, tab bar options,
 * StatusBar). The same values live as CSS variables in src/global.css for
 * NativeWind classes — keep both in sync when editing.
 */
export const palette = {
  light: {
    background: '#FEFAF6', // Warm Ivory — page bg, never plain white
    surface: '#FFFFFF', // Card lift
    primary: '#7B2D42', // Royal Burgundy — headings, primary CTAs
    teal: '#0E7C7B', // Peacock Teal — secondary CTAs, links, info
    gold: '#C5A47E', // Warm Gold — accents, dividers, premium
    goldMuted: '#7A5F3A', // Gold-muted — secondary text on ivory
    ink: '#2E2E38', // Primary text
    muted: '#6B6B76', // Muted text
    success: '#059669', // Green — verified, paid, completed
    warning: '#D97706', // Amber — pending KYC, deposit due
    destructive: '#DC2626', // Red — errors, refunds, blocks
  },
  dark: {
    background: '#1A1418', // Warm near-black
    surface: '#261F23', // Card lift on dark
    primary: '#E8B4C8', // Burgundy lightened to rose for contrast
    teal: '#4ECFD0',
    gold: '#D4AF85',
    goldMuted: '#B89968',
    ink: '#F5F2EF',
    muted: '#A09AA0',
    success: '#10B981',
    warning: '#F59E0B',
    destructive: '#EF4444',
  },
} as const;

export type ThemeColors = (typeof palette)['light' | 'dark'];

/** Appends an alpha channel to a 6-digit hex color, e.g. withAlpha(c, '33'). */
export function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

/** @deprecated Legacy alias for the light palette — use useThemeColors() instead. */
export const tokens = palette.light;
