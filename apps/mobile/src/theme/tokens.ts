/**
 * Design tokens — Phase-1.
 * Smart Shaadi color palette exported as a typed const.
 * Used in components when className doesn't apply (tab bar options, inline styles).
 */
export const tokens = {
  background: '#FEFAF6',    // Warm Ivory — page bg, never plain white
  surface: '#FFFFFF',       // Card lift
  primary: '#7B2D42',       // Royal Burgundy — headings, primary CTAs
  teal: '#0E7C7B',          // Peacock Teal — secondary CTAs, links, info
  gold: '#C5A47E',          // Warm Gold — accents, dividers, premium
  goldMuted: '#7A5F3A',     // Gold-muted — secondary text on ivory
  ink: '#2E2E38',           // Primary text
  muted: '#6B6B76',         // Muted text
  success: '#059669',       // Green — verified, paid, completed
  warning: '#D97706',       // Amber — pending KYC, deposit due
  destructive: '#DC2626',   // Red — errors, refunds, blocks
} as const;
