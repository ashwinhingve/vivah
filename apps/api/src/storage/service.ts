// apps/api/src/storage/service.ts

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../lib/env.js';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     env.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_KEY,
  },
});

/**
 * Generate a presigned GET URL for an R2 object.
 * When USE_MOCK_SERVICES=true, returns a stable mock URL without calling R2.
 */
export async function getPhotoUrl(r2Key: string, expiresIn = 900): Promise<string> {
  if (env.USE_MOCK_SERVICES) {
    return `https://mock-r2.smartshaadi.co.in/${r2Key}`;
  }
  const command = new GetObjectCommand({ Bucket: env.CLOUDFLARE_R2_BUCKET, Key: r2Key });
  return getSignedUrl(r2, command, { expiresIn });
}

/** Generate presigned GET URLs for multiple R2 keys in parallel. */
export async function getPhotoUrls(r2Keys: string[], expiresIn = 900): Promise<string[]> {
  return Promise.all(r2Keys.map(k => getPhotoUrl(k, expiresIn)));
}

/**
 * Generate a presigned PUT URL for uploading a file directly to R2.
 * Returns both the upload URL and the R2 key that will hold the object.
 */
export async function getPresignedUploadUrl(
  folder: string,
  fileName: string,
  mimeType: string,
  expiresIn = 300,
): Promise<{ uploadUrl: string; r2Key: string }> {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `${folder}/${Date.now()}-${sanitized}`;

  if (env.USE_MOCK_SERVICES) {
    return {
      uploadUrl: `https://mock-r2.smartshaadi.co.in/upload/${r2Key}`,
      r2Key,
    };
  }

  const command = new PutObjectCommand({
    Bucket: env.CLOUDFLARE_R2_BUCKET,
    Key: r2Key,
    ContentType: mimeType,
  });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn });
  return { uploadUrl, r2Key };
}
