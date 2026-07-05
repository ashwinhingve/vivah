// apps/api/src/storage/media.router.ts
//
// Always-on media redirect. Resolves an R2 key (mock or real) to a fresh
// URL and 302-redirects the browser to it:
//   - USE_MOCK_SERVICES && !R2_LIVE  → the local /__mock-r2 file server
//   - otherwise                      → a freshly-minted presigned R2 GET URL
//
// This is the production counterpart to /__mock-r2: the web client only ever
// receives BARE r2 keys in list/feed/chat responses, and turns them into
// `${API_ORIGIN}/__media/${key}` (see apps/web/src/lib/photo.ts). Because the
// stable outer URL is what the browser/CDN caches — never the short-lived
// presigned URL — the 15-minute presign expiry can never race a cached page.
//
// Unauthenticated by design (parity with the authorization already performed
// by whatever endpoint handed the bare key to the client). To stop this from
// becoming a permanent public gateway to sensitive uploads, it is scoped to
// display-media key prefixes only — `documents/` (wedding docs / KYC PDFs) and
// `invitations/` are intentionally excluded and 404 here.
import { Router, type Request, type Response } from 'express';
import { getPhotoUrl } from './service.js';

// Every key prefix produced by a getPresignedUploadUrl() caller that is later
// rendered through resolvePhotoUrl() on the web. Keep in sync when adding a new
// upload folder — anything not listed here 404s (fail-closed).
const ALLOWED_PREFIXES = [
  'photos/',        // profile photos + moodboard
  'avatars/',       // storage folder enum
  'portfolios/',    // vendor portfolios
  'products/',      // store products
  'chat/',          // chat media (chat/<matchId>/…)
  'chat-voice/',    // voice notes (chat-voice/<matchId>/…)
  'audio-intros/',  // profile audio intros
  'video-intros/',  // profile video intros
];

function safeKey(rawKey: string): string | null {
  // Express has already URL-decoded the wildcard param exactly once. Do NOT
  // decode again — a second decode lets `%252e%252e` collapse to `..` *after*
  // the traversal check (double-encoding bypass). Instead: reject any leftover
  // `%` (a legit R2 key from getPresignedUploadUrl only contains [A-Za-z0-9._/-]),
  // reject `..` as a path segment, and require a known display-media prefix.
  const key = rawKey.replace(/^\/+/, '');
  if (!key) return null;
  if (key.includes('%')) return null;                       // double-encoded → reject
  if (key.split('/').includes('..')) return null;           // no traversal segments
  if (!ALLOWED_PREFIXES.some(p => key.startsWith(p))) return null; // fail-closed allowlist
  return key;
}

export const mediaRouter: Router = Router();

mediaRouter.get('/*', async (req: Request, res: Response): Promise<void> => {
  const rawKey = (req.params as Record<string, string>)[0] ?? '';
  const key = safeKey(rawKey);
  if (!key) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Media not found' } });
    return;
  }
  // helmet defaults Cross-Origin-Resource-Policy to `same-origin`, which blocks
  // raw <img>/<audio> loads across the web↔api origin split. Opt this route out.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'private, max-age=60');
  try {
    const url = await getPhotoUrl(key);
    res.redirect(302, url);
  } catch (error) {
    console.error('[media] resolve error', error);
    res.status(502).json({ success: false, error: { code: 'MEDIA_RESOLVE_FAILED', message: 'Failed to resolve media URL' } });
  }
});
