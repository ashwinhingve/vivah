export const colors = {
  // Brand
  primary:       '#7B2D42',
  primaryHover:  '#5C2032',
  primaryLight:  '#A04460',  // for dark mode

  // Trust signals
  gold:          '#C5A47E',
  goldMuted:     '#9E7F5A',
  goldLight:     '#D4B896',  // for dark mode

  // Actions
  teal:          '#0E7C7B',
  tealHover:     '#149998',
  tealBright:    '#10A3A0',  // for dark mode CTAs

  // Backgrounds
  background:    '#FEFAF6',
  surface:       '#FFFFFF',
  surfaceMuted:  '#F8F5F0',  // disabled inputs, tag backgrounds

  // Dark mode backgrounds
  darkBg:        '#1A1A24',
  darkSurface:   '#2D2D3A',
  darkElevated:  '#363645',

  // Text
  textPrimary:   '#2E2E38',
  textMuted:     '#6B6B76',
  textOnDark:    '#F0EBE4',
  textMutedDark: '#9090A0',
  placeholder:   'rgba(107, 107, 118, 0.6)',  // input placeholder

  // Borders
  border:        '#E8E0D8',
  borderLight:   '#F0EBE4',
  borderDark:    '#404050',

  // Semantic
  success:       '#059669',
  warning:       '#D97706',
  error:         '#DC2626',
  info:          '#0E7C7B',
} as const

export const fonts = {
  heading: '"Playfair Display", Georgia, "Noto Serif Devanagari", serif',
  body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  hindi: '"Noto Serif Devanagari", "Noto Sans Devanagari", serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const

export const zIndex = {
  content:    0,
  sticky:     10,
  dropdown:   20,
  nav:        30,
  drawer:     40,
  modal:      50,
  toast:      60,
  tooltip:    70,
} as const

export type ColorKey = keyof typeof colors
export type FontKey = keyof typeof fonts