import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mutable env mock so each test can flip NODE_ENV / CORS_ORIGIN / WEB_URL.
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { NODE_ENV: 'production', CORS_ORIGIN: '', WEB_URL: 'https://smartshaadi.co.in' },
}))
vi.mock('../env.js', () => ({ env: mockEnv }))

import { isAllowedOrigin, staticAllowedOrigins, corsOriginDelegate, authTrustedOrigins } from '../cors.js'

beforeEach(() => {
  mockEnv.NODE_ENV = 'production'
  mockEnv.CORS_ORIGIN = ''
  mockEnv.WEB_URL = 'https://smartshaadi.co.in'
})

describe('isAllowedOrigin (production)', () => {
  it('allows the canonical prod origins', () => {
    expect(isAllowedOrigin('https://smartshaadi.co.in')).toBe(true)
    expect(isAllowedOrigin('https://www.smartshaadi.co.in')).toBe(true)
  })

  it('allows Vercel project alias + team-scoped preview URLs', () => {
    expect(isAllowedOrigin('https://vivah-web.vercel.app')).toBe(true)
    expect(isAllowedOrigin('https://vivah-web-smartshaadiofficial-7717s-projects.vercel.app')).toBe(true)
    expect(isAllowedOrigin('https://vivah-web-git-fix-soc-3b8525-smartshaadiofficial-7717s-projects.vercel.app')).toBe(true)
    expect(isAllowedOrigin('https://vivah-web-abc123def-smartshaadiofficial-7717s-projects.vercel.app')).toBe(true)
  })

  it('allows an explicit CORS_ORIGIN override', () => {
    mockEnv.CORS_ORIGIN = 'https://staging.smartshaadi.co.in'
    expect(isAllowedOrigin('https://staging.smartshaadi.co.in')).toBe(true)
  })

  it('rejects unknown / look-alike / non-https origins', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false)
    expect(isAllowedOrigin('https://evil.vercel.app')).toBe(false)
    expect(isAllowedOrigin('https://vivah-web.evil.com')).toBe(false)
    // right project prefix but NOT our team scope
    expect(isAllowedOrigin('https://vivah-web-git-x-someoneelse.vercel.app')).toBe(false)
    // our team scope but a different project (no vivah-web prefix)
    expect(isAllowedOrigin('https://other-app-smartshaadiofficial-7717s-projects.vercel.app')).toBe(false)
    expect(isAllowedOrigin('https://vivah-webx.vercel.app')).toBe(false)
    expect(isAllowedOrigin('http://vivah-web.vercel.app')).toBe(false) // not https
    expect(isAllowedOrigin('https://smartshaadi.co.in.evil.com')).toBe(false)
  })

  it('allows a missing Origin (same-origin / server-to-server)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true)
  })

  it('never includes a wildcard in the static allowlist', () => {
    expect(staticAllowedOrigins()).not.toContain('*')
  })
})

describe('isAllowedOrigin (development)', () => {
  beforeEach(() => { mockEnv.NODE_ENV = 'development'; mockEnv.WEB_URL = 'http://localhost:3000' })

  it('allows localhost siblings', () => {
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true)
  })

  it('still rejects an arbitrary origin', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false)
  })
})

describe('authTrustedOrigins', () => {
  it('covers the static prod origins plus tight Vercel preview globs (no bare *.vercel.app)', () => {
    const trusted = authTrustedOrigins()
    expect(trusted).toContain('https://smartshaadi.co.in')
    expect(trusted).toContain('https://vivah-web-*-smartshaadiofficial-7717s-projects.vercel.app')
    expect(trusted).toContain('https://vivah-web.vercel.app')
    // never an open wildcard that would trust any vercel app
    expect(trusted).not.toContain('*')
    expect(trusted).not.toContain('https://*.vercel.app')
  })
})

describe('corsOriginDelegate', () => {
  it('resolves allow=true for an allowed origin and false for a denied one', () => {
    const allow = vi.fn()
    corsOriginDelegate('https://smartshaadi.co.in', allow)
    expect(allow).toHaveBeenCalledWith(null, true)

    const deny = vi.fn()
    corsOriginDelegate('https://evil.com', deny)
    expect(deny).toHaveBeenCalledWith(null, false)
  })
})
