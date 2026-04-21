const RAW_API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
// Strip /api/v1 suffix if present — mock-r2 and storage endpoints sit at server root.
const API_ORIGIN = RAW_API_BASE.replace(/\/api\/v1\/?$/, '');

/**
 * Convert an R2 key (or pre-resolved URL) into something `<Image src>` accepts.
 * - Absolute http(s) URL → passes through unchanged.
 * - Bare R2 key (e.g. "profiles/123/photo.jpg") → prefixed with the API origin's
 *   mock-r2 route, which streams the file in dev mode.
 * - Falsy → null (caller should render fallback).
 */
export function resolvePhotoUrl(photoKey: string | null | undefined): string | null {
  if (!photoKey) return null;
  if (photoKey.startsWith('http://') || photoKey.startsWith('https://')) {
    return photoKey;
  }
  const key = photoKey.replace(/^\/+/, '');
  return `${API_ORIGIN}/__mock-r2/${key}`;
}
