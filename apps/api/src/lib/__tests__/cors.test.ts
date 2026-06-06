import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mutable env mock so each test can flip NODE_ENV / CORS_ORIGIN / WEB_URL.
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { NODE_ENV: 'production', CORS_ORIGIN: '', WEB_URL: 'https://smartshaadi.co.in' },
}))
vi.mock('../env.js', () => ({ env: mockEnv }))

import { isAllowedOrigin, staticAllowedOrigins, corsOriginDelegate } from '../cors.js'

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

  it('allows Vercel production + preview URLs for our project', () => {
    expect(isAllowedOrigin('https://smartshaadiofficial.vercel.app')).toBe(true)
    expect(isAllowedOrigin('https://smartshaadiofficial-git-fix-socket-auth-team.vercel.app')).toBe(true)
    expect(isAllowedOrigin('https://smartshaadiofficial-abc123def-team.vercel.app')).toBe(true)
  })

  it('allows an explicit CORS_ORIGIN override', () => {
    mockEnv.CORS_ORIGIN = 'https://staging.smartshaadi.co.in'
    expect(isAllowedOrigin('https://staging.smartshaadi.co.in')).toBe(true)
  })

  it('rejects unknown / look-alike / non-https origins', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false)
    expect(isAllowedOrigin('https://evil.vercel.app')).toBe(false)
    expect(isAllowedOrigin('https://evil-smartshaadiofficial.vercel.app')).toBe(false)
    expect(isAllowedOrigin('https://smartshaadiofficialx.vercel.app')).toBe(false)
    expect(isAllowedOrigin('http://smartshaadiofficial.vercel.app')).toBe(false) // not https
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
