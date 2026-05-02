import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { getPresignedUploadUrl } from './service.js';

export const storageRouter = Router();

const UploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  folder: z.enum(['photos', 'documents', 'portfolios', 'avatars', 'products']),
});

/**
 * POST /api/v1/storage/upload-url
 * Returns a pre-signed R2 PUT URL for direct client-side upload.
 * Body: { fileName: string, mimeType: string, folder: 'photos' | 'documents' | 'portfolios' | 'avatars' | 'products' }
 */
storageRouter.post(
  '/upload-url',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UploadUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', 'Invalid request', 400, { details: parsed.error.flatten() });
      return;
    }

    const { fileName, mimeType, folder } = parsed.data;

    try {
      const { uploadUrl, r2Key } = await getPresignedUploadUrl(folder, fileName, mimeType);
      ok(res, { uploadUrl, r2Key });
    } catch {
      err(res, 'INTERNAL', 'Failed to generate upload URL', 500);
    }
  },
);
