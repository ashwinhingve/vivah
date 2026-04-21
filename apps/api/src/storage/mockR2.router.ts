// apps/api/src/storage/mockR2.router.ts
//
// Dev-only stand-in for Cloudflare R2. When USE_MOCK_SERVICES=true, the
// storage service hands out upload/download URLs that point here instead of
// the public `mock-r2.smartshaadi.co.in` placeholder (which doesn't resolve).
//
// Files are written to `apps/api/.data/mock-r2/<r2Key>` and served back on GET.
// Mounted BEFORE `express.json()` so raw binary uploads aren't parsed away.
import { Router, raw, type Request, type Response } from 'express';
import { createReadStream, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';

const MOCK_R2_ROOT = resolve(process.cwd(), 'apps/api/.data/mock-r2');

function safeKeyToPath(rawKey: string): string | null {
  const key = decodeURIComponent(rawKey).replace(/^\/+/, '');
  const target = resolve(MOCK_R2_ROOT, key);
  const rel = relative(MOCK_R2_ROOT, target);
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) return null;
  return target;
}

export const mockR2Router: Router = Router();

// Accept any binary payload up to 15MB (covers the 10MB client-side cap plus headroom).
mockR2Router.put(
  '/upload/*',
  raw({ type: '*/*', limit: '15mb' }),
  (req: Request, res: Response): void => {
    const key = (req.params as Record<string, string>)[0] ?? '';
    const filePath = safeKeyToPath(key);
    if (!filePath) {
      res.status(400).json({ success: false, error: { code: 'INVALID_KEY', message: 'Invalid R2 key' } });
      return;
    }
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      writeFileSync(filePath, body);
      res.status(200).json({ success: true, data: { r2Key: key, bytes: body.length } });
    } catch (error) {
      console.error('[mock-r2] upload error', error);
      res.status(500).json({ success: false, error: { code: 'MOCK_R2_WRITE_FAILED', message: 'Failed to store mock upload' } });
    }
  },
);

mockR2Router.get('/*', (req: Request, res: Response): void => {
  const key = (req.params as Record<string, string>)[0] ?? '';
  const filePath = safeKeyToPath(key);
  if (!filePath || !existsSync(filePath)) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mock R2 object not found' } });
    return;
  }
  const size = statSync(filePath).size;
  res.setHeader('Content-Length', String(size));
  res.setHeader('Cache-Control', 'private, max-age=900');
  createReadStream(filePath).pipe(res);
});
