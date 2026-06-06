import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockEnv } = vi.hoisted(() => ({ mockEnv: { NODE_ENV: 'production' } }))
vi.mock('../../lib/env.js', () => ({ env: mockEnv }))

import { sessionCookieAttributes } from '../cookieAttributes.js'

beforeEach(() => { mockEnv.NODE_ENV = 'production' })

describe('sessionCookieAttributes', () => {
  it('production: SameSite=None; Secure; HttpOnly; Domain scoped to registrable domain', () => {
    const attrs = sessionCookieAttributes()
    expect(attrs.sameSite).toBe('none')
    expect(attrs.secure).toBe(true) // None is only honoured with Secure
    expect(attrs.httpOnly).toBe(true)
    expect(attrs.domain).toBe('.smartshaadi.co.in')
  })

  it('development: SameSite=Lax, insecure, no Domain (works over http://localhost)', () => {
    mockEnv.NODE_ENV = 'development'
    const attrs = sessionCookieAttributes()
    expect(attrs.sameSite).toBe('lax')
    expect(attrs.secure).toBe(false)
    expect(attrs.httpOnly).toBe(true)
    expect(attrs.domain).toBeUndefined()
  })

  it('never emits SameSite=None without Secure (browser-invalid combo)', () => {
    for (const node of ['production', 'development', 'test']) {
      mockEnv.NODE_ENV = node
      const attrs = sessionCookieAttributes()
      if (attrs.sameSite === 'none') expect(attrs.secure).toBe(true)
    }
  })
})
