import type { LinkPreview } from '@smartshaadi/types'
import { redis } from '../lib/redis.js'

const URL_REGEX = /https?:\/\/[^\s<>"']+/i
const CACHE_TTL_SEC = 60 * 60 * 24 // 24h

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
