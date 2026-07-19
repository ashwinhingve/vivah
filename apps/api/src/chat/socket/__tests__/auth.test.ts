import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Better Auth's getSession so the handshake auth path is deterministic
// and never touches a real DB/session store.
const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }))
vi.mock('../../../auth/config.js', () => ({
  auth: { api: { getSession: mockGetSession } },
}))

import { handshakeCookie, authenticateHandshake } from '../auth.js'

beforeEach(() => {
  mockGetSession.mockReset()
})

describe('handshakeCookie — credential resolution', () => {
  it('prefers a complete auth.cookie string and forwards it VERBATIM', () => {
    // The React Native path. `@better-auth/expo`'s authClient.getCookie() hands
    // back a whole Cookie header, so it must not be re-wrapped in a cookie name.
    const cookie = handshakeCookie({
      auth: { cookie: 'better-auth.session_token=rn123' },
      headers: {},
    })
    expect(cookie).toBe('better-auth.session_token=rn123')
  })

  it('preserves the __Secure- cookie name that prod issues', () => {
    // The reason source 1 exists at all: under `secure: true` Better Auth names
    // the cookie __Secure-better-auth.session_token. Rebuilding the name from a
    // bare token (source 2) hardcodes the DEV name and fails to authenticate in
    // prod. Forwarding the string whole is what makes native clients work there.
    const cookie = handshakeCookie({
      auth: { cookie: '__Secure-better-auth.session_token=prodtok' },
      headers: {},
    })
    expect(cookie).toBe('__Secure-better-auth.session_token=prodtok')
  })

  it('takes auth.cookie over both auth.token and the raw header', () => {
    const cookie = handshakeCookie({
      auth: { cookie: 'better-auth.session_token=winner', token: 'loser' },
      headers: { cookie: 'better-auth.session_token=alsoLoser' },
    })
    expect(cookie).toBe('better-auth.session_token=winner')
  })

  it('treats an empty auth.cookie as absent and falls through to auth.token', () => {
    const cookie = handshakeCookie({
      auth: { cookie: '', token: 'tok123' },
      headers: {},
    })
    expect(cookie).toBe('better-auth.session_token=tok123')
  })

  it('prefers an explicit auth.token, wrapping it in the session cookie name', () => {
    const cookie = handshakeCookie({ auth: { token: 'tok123' }, headers: {} })
    expect(cookie).toBe('better-auth.session_token=tok123')
  })

  it('falls back to the raw Cookie header when auth.token is absent (cross-origin path)', () => {
    const cookie = handshakeCookie({
      auth: {},
      headers: { cookie: 'better-auth.session_token=fromCookie; other=1' },
    })
    expect(cookie).toBe('better-auth.session_token=fromCookie; other=1')
  })

  it('treats an empty-string auth.token as absent and uses the header instead', () => {
    // This is the exact production regression: SocketProvider reads the httpOnly
    // cookie from document.cookie, gets '', and sends auth.token=''.
    const cookie = handshakeCookie({
      auth: { token: '' },
      headers: { cookie: 'better-auth.session_token=real' },
    })
    expect(cookie).toBe('better-auth.session_token=real')
  })

  it('returns null when neither a token nor a cookie header is present', () => {
    expect(handshakeCookie({ auth: {}, headers: {} })).toBeNull()
    expect(handshakeCookie({ auth: { token: '' }, headers: {} })).toBeNull()
  })
})

describe('authenticateHandshake — session validation', () => {
  it('authenticates via auth.token and returns the userId', async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: 'user-1' } })
    const userId = await authenticateHandshake({ auth: { token: 'tok' }, headers: {} })
    expect(userId).toBe('user-1')
    expect(mockGetSession).toHaveBeenCalledWith({
      headers: new Headers({ cookie: 'better-auth.session_token=tok' }),
    })
  })

  it('authenticates via the raw Cookie header when no auth.token is sent', async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: 'user-2' } })
    const userId = await authenticateHandshake({
      auth: {},
      headers: { cookie: 'better-auth.session_token=abc' },
    })
    expect(userId).toBe('user-2')
    expect(mockGetSession).toHaveBeenCalledWith({
      headers: new Headers({ cookie: 'better-auth.session_token=abc' }),
    })
  })

  it('authenticates a native client via auth.cookie', async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: 'user-rn' } })
    const userId = await authenticateHandshake({
      auth: { cookie: '__Secure-better-auth.session_token=rn' },
      headers: {},
    })
    expect(userId).toBe('user-rn')
    expect(mockGetSession).toHaveBeenCalledWith({
      headers: new Headers({ cookie: '__Secure-better-auth.session_token=rn' }),
    })
  })

  it('rejects (null) when no credential is present, without calling getSession', async () => {
    const userId = await authenticateHandshake({ auth: {}, headers: {} })
    expect(userId).toBeNull()
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('rejects (null) when the session has no user', async () => {
    mockGetSession.mockResolvedValueOnce({ user: null })
    const userId = await authenticateHandshake({ auth: { token: 'tok' }, headers: {} })
    expect(userId).toBeNull()
  })

  it('rejects (null) and never throws when getSession throws', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('db down'))
    const userId = await authenticateHandshake({ auth: { token: 'tok' }, headers: {} })
    expect(userId).toBeNull()
  })
})
