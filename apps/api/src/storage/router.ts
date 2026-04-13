import { Router, type Request, type Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { env } from '../lib/env.js';
import { ok, err } from '../lib/response.js';

export const storageRouter = Router();

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     env.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_KEY,
  },
});

const PresignSchema = z.object({
  fileName:    z.string().min(1).max(200),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  folder:      z.enum(['profiles', 'documents']),
});

/**
 * POST /api/v1/storage/presign
 * Returns a pre-signed R2 PUT URL so the client can upload directly.
 * When USE_MOCK_SERVICES=true, returns a mock URL (no R2 call).
 */
storageRouter.post('/presign', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = PresignSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }

  const { fileName, contentType, folder } = parsed.data;
  const userId = req.user!.id;
  const r2Key = `${folder}/${userId}/${Date.now()}-${fileName}`;

  if (env.USE_MOCK_SERVICES) {
    ok(res, {
      uploadUrl: `https://mock-r2.smartshaadi.co.in/upload/${Date.now()}`,
      r2Key,
      expiresIn: 900,
    });
    return;
  }

  const command = new PutObjectCommand({
    Bucket:      env.CLOUDFLARE_R2_BUCKET,
    Key:         r2Key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 900 });
  ok(res, { uploadUrl, r2Key, expiresIn: 900 });
});
