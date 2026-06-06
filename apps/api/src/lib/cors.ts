import { env } from './env.js'

/**
 * Vercel deployments of the `smartshaadiofficial` project — production alias and
 * per-branch / per-commit preview URLs:
 *   https://smartshaadiofficial.vercel.app
 *   https://smartshaadiofficial-git-<branch>-<team>.vercel.app
 *   https://smartshaadiofficial-<hash>-<team>.vercel.app
 * Anchored to the project prefix + `.vercel.app` suffix so it never matches an
 * arbitrary third-party *.vercel.app origin.
 */
const VERCEL_PREVIEW_RE = /^https:\/\/smartshaadiofficial(?:-[a-z0-9-]+)?\.vercel\.app$/

/**
 * Exact origins always permitted. Production: optional CORS_ORIGIN override +
 * WEB_URL + the canonical apex hostnames. Dev: localhost siblings. Computed per
 * call so it reflects the current env (and stays test-mockable).
 */
export function staticAllowedOrigins(): string[] {
  return env.NODE_ENV === 'production'
    ? [env.CORS_ORIGIN, env.WEB_URL, 'https://smartshaadi.co.in', 'https://www.smartshaadi.co.in']
        .filter((o): o is string => Boolean(o))
    : [env.WEB_URL, 'http://localhost:3000', 'http://127.0.0.1:3000']
}

/**
 * True when the request Origin is permitted: an exact allowlist match or a
 * Vercel preview/production URL for our project. A missing Origin (same-origin
 * navigations, curl, server-to-server) is allowed — credentialed browser
 * requests always send one, so this never widens the credentialed surface.
 * Never returns true for a wildcard.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  if (staticAllowedOrigins().includes(origin)) return true
  return VERCEL_PREVIEW_RE.test(origin)
}

/**
 * Origin delegate compatible with both the `cors` express middleware and
 * socket.io's CORS (which uses the same `cors` package under the hood). Denies
 * by resolving `allow=false` (no ACAO header emitted) rather than throwing.
 */
export function corsOriginDelegate(
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
): void {
  cb(null, isAllowedOrigin(origin))
}
