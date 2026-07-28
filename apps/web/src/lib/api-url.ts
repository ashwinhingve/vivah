/**
 * Single source of truth for the API base URL (audit A4-05).
 *
 * `NEXT_PUBLIC_*` vars are inlined by Next at build time, so this const works in both
 * server and client components. In development it falls back to localhost; in a
 * PRODUCTION build it THROWS if the env var is unset — so we can never silently ship
 * the localhost fallback to prod, which the previous ~181 inline
 * `process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'` fallbacks each risked.
 */
const resolved = process.env.NEXT_PUBLIC_API_URL?.trim();

// Fail loud only on a real PRODUCTION DEPLOY (Vercel sets VERCEL_ENV='production')
// that forgot the var — that is the case where shipping the localhost fallback would
// actually reach users. Local, CI, and preview builds have VERCEL_ENV unset/other and
// keep the localhost dev fallback so `next build`/`type-check` still work everywhere.
if (!resolved && process.env.VERCEL_ENV === 'production') {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set in the production deployment. Refusing to fall back ' +
      'to localhost — set NEXT_PUBLIC_API_URL in the Vercel production environment.',
  );
}

export const API_URL: string = resolved || 'http://localhost:4000';
