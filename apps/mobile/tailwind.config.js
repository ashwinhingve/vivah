/** @type {import('tailwindcss').Config} */
// Smart Shaadi design tokens (see root CLAUDE.md → "UI Design System").
// Teammate A owns theme extensions (fonts, radii, shadows); the color tokens
// below are frozen in Phase 0 so both teammates share one palette.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#FEFAF6', // Warm Ivory — page bg (never plain white)
        surface: '#FFFFFF', // card lift
        primary: '#7B2D42', // Royal Burgundy — headings, primary CTAs, brand
        teal: '#0E7C7B', // Peacock Teal — secondary CTAs, links
        gold: '#C5A47E', // Warm Gold — accents, premium
        'gold-muted': '#7A5F3A', // secondary text on ivory (WCAG-AA)
        success: '#059669',
        warning: '#D97706',
        destructive: '#DC2626',
        ink: '#2E2E38', // primary text
        muted: '#6B6B76', // muted text
      },
    },
  },
  plugins: [],
};
