import { lookup } from 'node:dns/promises'
import ipaddr from 'ipaddr.js'
import { isIP } from 'node:net'
import type { LinkPreview } from '@smartshaadi/types'
import { redis } from '../lib/redis.js'

const URL_REGEX = /https?:\/\/[^\s<>"']+/i
const CACHE_TTL_SEC = 60 * 60 * 24 // 24h
const DNS_LOOKUP_TIMEOUT_MS = 2000

// Block private / link-local / loopback ranges to prevent SSRF into cloud
// metadata services (169.254.169.254), kubelets, internal RDS, etc.
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,           // link-local incl. AWS/GCP/Azure metadata
  /^metadata\.google/i,
  /^metadata\.googleapis/i,
  /^\[?::1\]?$/,           // IPv6 loopback
  /^\[?fc00:/i,            // IPv6 unique-local
  /^\[?fe80:/i,            // IPv6 link-local
]

export function isSafeFetchHost(hostname: string): boolean {
  if (!hostname) return false
  return !BLOCKED_HOST_PATTERNS.some((p) => p.test(hostname))
}

/**
 * True only when ipaddr.js classifies the address as public unicast.
 * Rejects private, loopback, linkLocal, multicast, broadcast, reserved,
 * unspecified, carrierGradeNat (v4) and uniqueLocal, ipv4Mapped, teredo,
 * 6to4, rfc6052/6145 (v6).
 */
function isPublicUnicastIp(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip)
    return parsed.range() === 'unicast'
  } catch {
    return false
  }
}

/**
 * Resolve hostname → IPs and verify every result is public unicast. Closes
 * the DNS-rebinding hole left by hostname-only regex blocklist: an attacker
 * domain that resolves to 169.254.169.254 (or any RFC-1918) is rejected
 * here even though the hostname itself looks innocent.
 *
 * Fail-closed: any DNS error or empty result returns false.
 */
export async function resolveAndValidateHost(hostname: string): Promise<boolean> {
  // Fast-path: hostname is already a literal IP — no DNS round-trip needed.
  // (`isSafeFetchHost` regex already catches common literals; this is
  // defence-in-depth covering exotic forms like `0177.0.0.1`.)
  if (isIP(hostname)) return isPublicUnicastIp(hostname)

  let addrs: { address: string; family: number }[]
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), DNS_LOOKUP_TIMEOUT_MS)
    try {
      addrs = await lookup(hostname, { all: true })
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
  if (addrs.length === 0) return false
  return addrs.every((a) => isPublicUnicastIp(a.address))
}

export function extractFirstUrl(text: string): string | null {
  const m = text.match(URL_REGEX)
  return m ? m[0] : null
}

function pickMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const m = html.match(re)
  return m ? m[1] ?? null : null
}

function pickTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? (m[1] ?? '').trim() : null
}

/**
 * Fetch a lightweight link preview by parsing OpenGraph + <title> tags.
 * Cached in Redis for 24h. Returns null on any failure — link previews are
 * a UX bonus, never a hard dependency.
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!isSafeFetchHost(url.hostname)) return null
  // DNS-rebinding guard — hostname might be public-looking but resolve to
  // an internal IP. Always do the lookup before fetch.
  if (!(await resolveAndValidateHost(url.hostname))) return null

  const cacheKey = `linkPreview:${url.toString()}`
  try {
    const hit = await redis.get(cacheKey)
    if (hit) return JSON.parse(hit) as LinkPreview
  } catch {
    /* ignore cache errors */
  }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'SmartShaadiBot/1.0 (link-preview)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html')) return null
    const html = (await res.text()).slice(0, 200_000)
    const preview: LinkPreview = {
      url: url.toString(),
      title: pickMeta(html, 'og:title') ?? pickTitle(html),
      description:
        pickMeta(html, 'og:description') ?? pickMeta(html, 'description'),
      image: pickMeta(html, 'og:image'),
    }
    try {
      await redis.set(cacheKey, JSON.stringify(preview), 'EX', CACHE_TTL_SEC)
    } catch {
      /* ignore */
    }
    return preview
  } catch {
    return null
  }
}
