import { auth } from '../../auth/config.js'

/**
 * Structural subset of socket.io's `Handshake` that the auth path reads. Kept
 * local so this module stays unit-testable without constructing a real socket.
 */
export interface HandshakeLike {
  auth: Record<string, unknown>
  headers: { cookie?: string | undefined }
}

/**
 * Resolve the Cookie header to hand to Better Auth from a socket handshake.
 *
 * Three credential sources, in priority order:
 *  1. `handshake.auth.cookie` — a COMPLETE Cookie header string, supplied by a
 *     client that holds the cookie itself instead of in a browser jar. This is
 *     the React Native path (Phase 7 Unit 7.1): `@better-auth/expo` persists the
 *     server's Set-Cookie into expo-secure-store and hands it back whole via
 *     `authClient.getCookie()`. We forward it untouched — that is the point; see
 *     the warning on source 2 about cookie NAMES.
 *  2. `handshake.auth.token` — a bare token value, wrapped in the non-Secure
 *     cookie name. WARNING: that name is only correct while Better Auth issues
 *     non-Secure cookies (dev). Under `secure: true` the cookie is named
 *     `__Secure-better-auth.session_token` (auth/cookieAttributes.ts sets
 *     secure/sameSite per env), so this branch does NOT authenticate in prod.
 *     It has survived because the browser client's `auth.token` is empty in prod
 *     anyway — the cookie is httpOnly, so JS cannot read it — leaving web to
 *     fall through to source 3. Prefer source 1 for any non-browser client.
 *  3. `handshake.headers.cookie` — the raw Cookie header. A cross-origin browser
 *     connecting with `withCredentials` carries the httpOnly session cookie
 *     here. Cross-subdomain works because the cookie is set
 *     `Domain=.smartshaadi.co.in; SameSite=None; Secure` (ADR-002): the Domain
 *     shares it across the web/api subdomains, and SameSite=None is required
 *     because web↔api is a cross-site request for cookie purposes (Lax would be
 *     dropped on the cross-origin handshake). Dev over http falls back to Lax.
 *     React Native cannot use this path — there is no jar to populate it.
 *
 * Returns null when no source carries a credential.
 */
export function handshakeCookie(handshake: HandshakeLike): string | null {
  const cookie = handshake.auth['cookie']
  if (typeof cookie === 'string' && cookie.length > 0) {
    return cookie
  }
  const token = handshake.auth['token']
  if (typeof token === 'string' && token.length > 0) {
    return `better-auth.session_token=${token}`
  }
  return handshake.headers.cookie ?? null
}

/**
 * Validate a socket handshake's Better Auth session. Returns the authenticated
 * userId, or null when no valid session is present (caller rejects with
 * `Unauthorized`). Never throws — a getSession failure resolves to null.
 */
export async function authenticateHandshake(handshake: HandshakeLike): Promise<string | null> {
  const cookie = handshakeCookie(handshake)
  if (!cookie) return null
  try {
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    })
    return session?.user?.id ?? null
  } catch {
    return null
  }
}
