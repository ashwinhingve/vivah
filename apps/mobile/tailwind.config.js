/** @type {import('tailwindcss').Config} */
// Smart Shaadi design tokens (see root CLAUDE.md → "UI Design System").
// Colors resolve through the CSS variables in src/global.css so light/dark
// switch automatically with the OS scheme; hex sources live in src/theme/tokens.ts.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        teal: 'rgb(var(--color-teal) / <alpha-value>)',
        gold: 'rgb(var(--color-gold) / <alpha-value>)',
        'gold-muted': 'rgb(var(--color-gold-muted) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        destructive: 'rgb(var(--color-destructive) / <alpha-value>)',
      },
      fontFamily: {
        heading: ['PlayfairDisplay_600SemiBold'],
        'heading-bold': ['PlayfairDisplay_700Bold'],
      },
    },
  },
};
