/**
 * Centralized motion timing — single source of truth for the whole web app.
 *
 * All framer-motion durations/easings/offsets live here so the two motion
 * namespaces (`components/motion/*` and `components/shared/*`) stay in lock-step.
 * The one CSS-driven animation (toast slide-in) lives in globals.css
 * (`@keyframes toast-in` / `.animate-toast-in`); `toastMs` below documents the
 * canonical value and must be kept in sync with that rule manually.
 *
 * Day 7: established to converge the previously-diverged `shared/` primitives
 * (10px / 250ms / 70ms) onto the `motion/` baseline (4px / 180ms / 40ms).
 */
export const EASE_OUT = 'easeOut' as const;

export const MOTION = {
  /** Page mount: fade + 8px slide-up, 200ms ease-out. */
  page: { duration: 0.2, ease: EASE_OUT, y: 8 },
  /** Staggered list: 40ms between items; each item fade + 4px slide-up, 180ms. */
  stagger: {
    childDelay: 0.04,
    item: { duration: 0.18, ease: EASE_OUT, y: 4 },
  },
  /** Single fade-up (FadeUp) — matches the stagger-item feel. */
  fade: { duration: 0.18, ease: EASE_OUT, y: 4 },
  /** Reduced-motion fallback: opacity-only, fast. */
  reduced: { duration: 0.15 },
  /** Number count-up, seconds. */
  numberSec: 1,
  /** Card hover lift, ms (mirror of Tailwind `duration-150`). */
  hoverMs: 150,
  /** Modal / drawer slide-in. */
  drawer: { duration: 0.25, ease: EASE_OUT },
  /** Tab content cross-fade, ms. */
  tabSwapMs: 150,
  /** Toast slide-in, ms — mirror of globals.css `.animate-toast-in`. */
  toastMs: 220,
} as const;
