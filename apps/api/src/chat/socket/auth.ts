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
 * Two credential sources, in priority order:
 *  1. `handshake.auth.token` — explicit token (the server-component-fed prop
 *     path, where the web app reads the cookie server-side and passes it).
 *  2. `handshake.headers.cookie` — the raw Cookie header. A cross-origin client
 *     connecting with `withCredentials` carries the httpOnly session cookie
 *     here; JS cannot read that cookie (auth/config.ts httpOnly:true) so its
 *     `auth.token` is empty. We accept the raw header so that path authenticates
 *     too. Cross-subdomain works because the cookie is set
 *     `Domain=.smartshaadi.co.in; SameSite=None; Secure` (ADR-002): the Domain
 *     shares it across the web/api subdomains, and SameSite=None is required
 *     because web↔api is a cross-site request for cookie purposes (Lax would be
 *     dropped on the cross-origin handshake). Dev over http falls back to Lax.
 *
 * Returns null when neither source carries a credential.
 */
export function handshakeCookie(handshake: HandshakeLike): string | null {
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
