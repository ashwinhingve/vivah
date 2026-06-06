import { env } from '../lib/env.js'

export interface SessionCookieAttributes {
  httpOnly: true
  secure: boolean
  sameSite: 'none' | 'lax'
  domain?: string
}

/**
 * Attributes for the Better Auth `session_token` cookie.
 *
 * Production: `SameSite=None; Secure` so the cookie is sent on genuine
 * cross-site credentialed requests — Vercel preview origins (*.vercel.app) and
 * smartshaadi.co.in ↔ api.smartshaadi.co.in — to the API. `SameSite=None` is
 * only honoured by browsers together with `Secure`, so both gate on production.
 * `Domain=.smartshaadi.co.in` scopes the cookie to the API's registrable domain
 * (where it is set and read), independent of the requesting frontend origin.
 *
 * Dev: `SameSite=Lax`, insecure — so the cookie still works over
 * http://localhost (a `Secure` cookie is never set/sent over plain http).
 *
 * `httpOnly` stays true in both — JS never reads it; cross-origin sockets carry
 * it via the handshake Cookie header (see chat/socket/auth.ts).
 */
export function sessionCookieAttributes(): SessionCookieAttributes {
  const isProd = env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    ...(isProd ? { domain: '.smartshaadi.co.in' } : {}),
  }
}
