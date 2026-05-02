// ─────────────────────────────────────────────────────────────────────────────
// Face match adapter — compares profile selfie against Aadhaar e-KYC photo.
// Real path: AWS Rekognition CompareFaces. Mock: deterministic score from key.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { env } from '../lib/env.js';
import type { FaceMatchResult } from '@smartshaadi/types';

export interface FaceMatchArgs {
  selfieR2Key: string;
  // Aadhaar reference photo lives in a private bucket addressed by aadhaarRefId
  aadhaarRefId: string;
}

const MATCH_THRESHOLD = 75;

export async function compareFaces(args: FaceMatchArgs): Promise<FaceMatchResult> {
  if (env.USE_MOCK_SERVICES) {
    // Deterministic 60–98 score from hash so tests are stable
    const h = createHash('sha256').update(args.selfieR2Key + args.aadhaarRefId).digest();
    const score = 60 + (h[0]! % 39);
    return {
      matched:    score >= MATCH_THRESHOLD,
      score,
      analyzedAt: new Date().toISOString(),
    };
  }

  // TODO: AWS Rekognition CompareFaces:
  //   const out = await rekog.send(new CompareFacesCommand({
  //     SourceImage: { Bytes: selfieBytes },
  //     TargetImage: { Bytes: aadhaarPhotoBytes },
  //     SimilarityThreshold: MATCH_THRESHOLD,
  //   }));
  //   const top = out.FaceMatches?.[0];
  //   return { matched: !!top, score: top?.Similarity ?? 0, analyzedAt: ... };
  throw new Error('Real face-match provider not yet configured');
}

export const FACE_MATCH_THRESHOLD = MATCH_THRESHOLD;
