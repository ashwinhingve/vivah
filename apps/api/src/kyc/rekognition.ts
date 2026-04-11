import { RekognitionClient, DetectFacesCommand, Attribute } from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../lib/env.js';
import type { PhotoAnalysis } from '@smartshaadi/types';

// Mock response returned when USE_MOCK_SERVICES=true.
// Always passes — admin still manually reviews via the queue.
const MOCK_ANALYSIS: PhotoAnalysis = {
  isRealPerson:    true,
  confidenceScore: 99,
  hasSunglasses:   false,
  multipleFaces:   false,
  analyzedAt:      '', // filled at call time
};

// Clients are created lazily so test mocks applied in beforeEach are active
// at instantiation time — module-level singletons would capture the unmocked
// constructor return before beforeEach runs.
let _rekognition: RekognitionClient | undefined;
let _r2: S3Client | undefined;

function getRekognition(): RekognitionClient {
  if (!_rekognition) {
    _rekognition = new RekognitionClient({ region: env.AWS_REKOGNITION_REGION });
  }
  return _rekognition;
}

// Uses Cloudflare R2 credentials (S3-compatible API) to fetch image bytes
function getR2(): S3Client {
  if (!_r2) {
    _r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     env.CLOUDFLARE_R2_ACCESS_KEY,
        secretAccessKey: env.CLOUDFLARE_R2_SECRET_KEY,
      },
    });
  }
  return _r2;
}

async function fetchImageBytes(r2Key: string): Promise<Uint8Array> {
  const res = await getR2().send(new GetObjectCommand({
    Bucket: env.CLOUDFLARE_R2_BUCKET,
    Key:    r2Key,
  }));
  if (!res.Body) throw new Error(`Empty body for R2 key: ${r2Key}`);
  return res.Body.transformToByteArray();
}

export async function analyzePhoto(r2Key: string): Promise<PhotoAnalysis> {
  // Read from process.env directly (not cached env) so tests can override per-block.
  if (process.env['USE_MOCK_SERVICES'] === 'true') {
    return { ...MOCK_ANALYSIS, analyzedAt: new Date().toISOString() };
  }

  const imageBytes = await fetchImageBytes(r2Key);

  const result = await getRekognition().send(new DetectFacesCommand({
    Image:      { Bytes: imageBytes },
    Attributes: [Attribute.ALL],
  }));

  const faces = result.FaceDetails ?? [];
  const multipleFaces   = faces.length > 1;
  const face            = faces[0];
  const isRealPerson    = faces.length > 0 && (face?.Confidence ?? 0) > 90;
  const confidenceScore = face?.Confidence ?? 0;
  const hasSunglasses   = face?.Sunglasses?.Value === true && (face.Sunglasses?.Confidence ?? 0) > 80;

  return {
    isRealPerson,
    confidenceScore,
    hasSunglasses,
    multipleFaces,
    analyzedAt: new Date().toISOString(),
  };
}
