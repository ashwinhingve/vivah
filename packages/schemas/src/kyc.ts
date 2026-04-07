import { z } from 'zod';

export const KycInitiateSchema = z.object({
  redirectUri: z.string().url('redirectUri must be a valid URL'),
});

export const KycPhotoSchema = z.object({
  r2Key: z.string().min(1, 'r2Key is required').max(500),
});

export const AdminReviewSchema = z.object({
  note: z.string().max(1000).optional(),
});

// Used internally for validating Rekognition output before persisting
// AWS Rekognition returns confidence as 0–100 (not 0–1)
export const PhotoAnalysisSchema = z.object({
  isRealPerson:    z.boolean(),
  confidenceScore: z.number().min(0).max(100),
  hasSunglasses:   z.boolean(),
  multipleFaces:   z.boolean(),
  analyzedAt:      z.string().datetime(),
});

export type KycInitiateInput   = z.infer<typeof KycInitiateSchema>;
export type KycPhotoInput      = z.infer<typeof KycPhotoSchema>;
export type AdminReviewInput   = z.infer<typeof AdminReviewSchema>;
export type PhotoAnalysisResult = z.infer<typeof PhotoAnalysisSchema>;
