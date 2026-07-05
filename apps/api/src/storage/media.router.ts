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
// Scoped to display-media key prefixes only — `documents/` (wedding docs / KYC
// PDFs) and `invitations/` are intentionally excluded and 404 here.
//
// Auth model: image prefixes (photos/, chat/, portfolios/, products/, avatars/)
// are rendered through next/image, whose server-side optimizer fetches this URL
// WITHOUT the user's session cookie — so they cannot be cookie-gated without
// breaking every image, and instead rely on the allowlist + non-enumerable
// (UUID-keyed) object names until signed URLs land. The private plain-media
// prefixes (chat-voice/, audio-intros/, video-intros/) are rendered via
// <audio>/<video> — a direct browser fetch that DOES carry the cookie — so they
// require a valid session, and chat-voice additionally verifies the caller is a
// participant of the match.
import { Router, type Request, type Response } from 'express';
import { and, eq, or } from 'drizzle-orm';
import { getPhotoUrl } from './service.js';
import { auth } from '../auth/config.js';
import { fromNodeHeaders } from 'better-auth/node';
import { db } from '../lib/db.js';
import { matchRequests } from '@smartshaadi/db';
import { resolveProfileId } from '../lib/profile.js';

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Private plain-media prefixes that must not be served to anonymous callers.
// (Image prefixes are deliberately absent — see the header note.)
const AUTH_REQUIRED_PREFIXES = ['chat-voice/', 'audio-intros/', 'video-intros/'];

async function sessionUserId(req: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user?.id ?? null;
}

/** chat-voice/<matchId>/… — caller must be a participant (sender/receiver) of the match. */
async function callerOwnsChatVoice(userId: string, key: string): Promise<boolean> {
  const matchId = key.split('/')[1] ?? '';
  if (!UUID_RE.test(matchId)) return false;                 // avoids invalid-uuid query throws
  const me = await resolveProfileId(userId);
  if (!me) return false;
  const [row] = await db
    .select({ id: matchRequests.id })
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.id, matchId),
        or(eq(matchRequests.senderId, me), eq(matchRequests.receiverId, me)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export const mediaRouter: Router = Router();

mediaRouter.get('/*', async (req: Request, res: Response): Promise<void> => {
  const rawKey = (req.params as Record<string, string>)[0] ?? '';
  const key = safeKey(rawKey);
  if (!key) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Media not found' } });
    return;
  }

  // Gate the private plain-media prefixes on a valid session; chat-voice also
  // requires match participation. Image prefixes fall through (see header note).
  if (AUTH_REQUIRED_PREFIXES.some(p => key.startsWith(p))) {
    const userId = await sessionUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    if (key.startsWith('chat-voice/') && !(await callerOwnsChatVoice(userId, key))) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized for this media' } });
      return;
    }
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
