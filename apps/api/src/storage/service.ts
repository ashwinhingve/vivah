// apps/api/src/storage/service.ts

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { env, shouldUseMockR2 } from '../lib/env.js';

const r2 = new S3Client({
  region: 'auto',
  // Prefer the explicit endpoint (matches Railway config); fall back to the
  // account-derived host for dev/test where only the account id is set.
  endpoint: env.CLOUDFLARE_R2_ENDPOINT || `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  // Cloudflare R2 does not provision SSL certs for bucket subdomains; the
  // default virtual-hosted style produces `<bucket>.<account>.r2.cloudflarestorage.com`
  // which fails with ERR_SSL_VERSION_OR_CIPHER_MISMATCH in the browser.
  // Force path-style so URLs become `<account>.r2.cloudflarestorage.com/<bucket>/<key>`.
  forcePathStyle: true,
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
  if (shouldUseMockR2) {
    return `${env.API_BASE_URL}/__mock-r2/${r2Key}`;
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
/**
 * Callers MUST pass a `folder` that already isolates the owner — either a
 * per-entity prefix (`audio-intros/${profileId}`, `chat/${matchId}`) or, for the
 * generic /upload-url endpoint, `${folder}/${userId}`. The key derived here is
 * otherwise unguessable but not owner-scoped, and R2 has no per-object ACL to
 * fall back on.
 */
export async function getPresignedUploadUrl(
  folder: string,
  fileName: string,
  mimeType: string,
  expiresIn = 300,
): Promise<{ uploadUrl: string; r2Key: string }> {
  // Strip anything outside the safe set, then neutralise dot-runs: the previous
  // character class permitted "..", so a crafted filename could still climb a
  // path segment in any consumer that resolves the key as a filesystem path.
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'file';

  // randomUUID, not Date.now(): the timestamp was only millisecond-granular, so
  // two uploads of the same filename in the same millisecond collided — the
  // second silently overwrote the first. It was also guessable, which mattered
  // more before the owner segment above existed.
  const r2Key = `${folder}/${randomUUID()}-${sanitized}`;

  if (shouldUseMockR2) {
    return {
      uploadUrl: `${env.API_BASE_URL}/__mock-r2/upload/${r2Key}`,
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
