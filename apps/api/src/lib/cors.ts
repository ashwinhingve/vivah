import { env } from './env.js'

/**
 * Vercel deployments of the web app. The Vercel project is `vivah-web` and our
 * Vercel team scope is `smartshaadiofficial-7717s-projects`, so deploy URLs are:
 *   https://vivah-web.vercel.app                                            (project alias)
 *   https://vivah-web-smartshaadiofficial-7717s-projects.vercel.app         (team-scoped alias)
 *   https://vivah-web-git-<branch>-smartshaadiofficial-7717s-projects.vercel.app  (branch preview)
 *   https://vivah-web-<hash>-smartshaadiofficial-7717s-projects.vercel.app        (commit preview)
 * Anchored to BOTH the `vivah-web` project prefix and the unique team suffix so
 * it never matches an arbitrary third-party *.vercel.app origin.
 */
const VERCEL_PREVIEW_RES = [
  /^https:\/\/vivah-web(?:-[a-z0-9-]+)?-smartshaadiofficial-7717s-projects\.vercel\.app$/,
  /^https:\/\/vivah-web\.vercel\.app$/,
]

/**
 * Same set expressed as Better Auth `trustedOrigins` glob patterns. Better
 * Auth matches these with separator `/`, so `*` matches any non-slash host
 * chars — equivalent to the regexes above for our single-label preview hosts.
 */
const VERCEL_PREVIEW_GLOBS = [
  'https://vivah-web-*-smartshaadiofficial-7717s-projects.vercel.app',
  'https://vivah-web-smartshaadiofficial-7717s-projects.vercel.app',
  'https://vivah-web.vercel.app',
]

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
  return VERCEL_PREVIEW_RES.some((re) => re.test(origin))
}

/**
 * Origins Better Auth should trust for CSRF / callback validation. Must cover
 * the SAME set as isAllowedOrigin() — Express CORS letting a preflight through
 * is useless if Better Auth then rejects the auth POST on origin grounds. Exact
 * static origins + the Vercel preview globs.
 */
export function authTrustedOrigins(): string[] {
  return [...staticAllowedOrigins(), ...VERCEL_PREVIEW_GLOBS]
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
