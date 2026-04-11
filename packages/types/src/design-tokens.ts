export const colors = {
  primary:      '#7B2D42',
  primaryHover: '#5C2032',
  gold:         '#C5A47E',
  goldMuted:    '#9E7F5A',
  teal:         '#0E7C7B',
  tealHover:    '#149998',
  background:   '#FEFAF6',
  surface:      '#FFFFFF',
  dark:         '#2D2D3A',
  textPrimary:  '#2E2E38',
  textMuted:    '#6B6B76',
} as const

export type ColorKey = keyof typeof colors
