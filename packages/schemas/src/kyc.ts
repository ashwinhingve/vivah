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

// PAN: ABCDE1234F (5 letters + 4 digits + 1 letter)
export const PanRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const KycPanSchema = z.object({
  pan: z.string()
    .transform(v => v.toUpperCase().trim())
    .pipe(z.string().regex(PanRegex, 'Invalid PAN format')),
  nameOnPan: z.string().min(2).max(100),
  dob:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dob must be YYYY-MM-DD'),
});

export const KycLivenessSchema = z.object({
  videoR2Key:       z.string().min(1).max(500),
  selfieR2Key:      z.string().min(1).max(500).optional(),
  challengesPassed: z.array(z.string()).default([]),
});

export const KycFaceMatchSchema = z.object({
  selfieR2Key: z.string().min(1).max(500),
});

// IFSC: 4 letters + 0 + 6 alphanumeric. Account: 9-18 digits.
export const IfscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const KycBankSchema = z.object({
  accountNumber: z.string().regex(/^\d{9,18}$/, 'Invalid account number'),
  ifsc: z.string()
    .transform(v => v.toUpperCase().trim())
    .pipe(z.string().regex(IfscRegex, 'Invalid IFSC code')),
  accountHolderName: z.string().min(2).max(100),
});

export const KycDocumentTypeSchema = z.enum([
  'AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE',
  'EMPLOYMENT_LETTER', 'EDUCATION_CERTIFICATE', 'BANK_STATEMENT',
  'UTILITY_BILL', 'SELFIE', 'LIVENESS_VIDEO', 'OTHER',
]);

export const KycDocumentSchema = z.object({
  documentType:   KycDocumentTypeSchema,
  r2Key:          z.string().min(1).max(500),
  documentLast4:  z.string().max(8).optional(),
  expiresAt:      z.string().datetime().optional(),
});

export const KycAppealSchema = z.object({
  message:        z.string().min(20, 'Appeal must explain in detail (min 20 chars)').max(2000),
  evidenceR2Keys: z.array(z.string().min(1).max(500)).max(5).default([]),
});

export const KycReverifySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const AdminInfoRequestSchema = z.object({
  note:         z.string().min(10, 'Provide a clear request to the user').max(1000),
  requiredDocs: z.array(KycDocumentTypeSchema).max(5).default([]),
});

export const AdminAppealResolveSchema = z.object({
  decision: z.enum(['UPHOLD', 'DENY']),
  note:     z.string().max(1000).optional(),
});

export const LivenessResultSchema = z.object({
  passed:           z.boolean(),
  score:            z.number().min(0).max(100),
  challengesPassed: z.array(z.string()),
  spoofIndicators:  z.array(z.string()),
  analyzedAt:       z.string().datetime(),
});

export const FaceMatchResultSchema = z.object({
  matched:    z.boolean(),
  score:      z.number().min(0).max(100),
  analyzedAt: z.string().datetime(),
});

export const SanctionsResultSchema = z.object({
  hit:          z.boolean(),
  listsChecked: z.array(z.string()),
  matchScore:   z.number().min(0).max(100),
  checkedAt:    z.string().datetime(),
});

export type KycInitiateInput        = z.infer<typeof KycInitiateSchema>;
export type KycPhotoInput           = z.infer<typeof KycPhotoSchema>;
export type AdminReviewInput        = z.infer<typeof AdminReviewSchema>;
export type PhotoAnalysisResult     = z.infer<typeof PhotoAnalysisSchema>;
export type KycPanInput             = z.infer<typeof KycPanSchema>;
export type KycLivenessInput        = z.infer<typeof KycLivenessSchema>;
export type KycFaceMatchInput       = z.infer<typeof KycFaceMatchSchema>;
export type KycBankInput            = z.infer<typeof KycBankSchema>;
export type KycDocumentInput        = z.infer<typeof KycDocumentSchema>;
export type KycAppealInput          = z.infer<typeof KycAppealSchema>;
export type KycReverifyInput        = z.infer<typeof KycReverifySchema>;
export type AdminInfoRequestInput   = z.infer<typeof AdminInfoRequestSchema>;
export type AdminAppealResolveInput = z.infer<typeof AdminAppealResolveSchema>;
export type LivenessResultData      = z.infer<typeof LivenessResultSchema>;
export type FaceMatchResultData     = z.infer<typeof FaceMatchResultSchema>;
export type SanctionsResultData     = z.infer<typeof SanctionsResultSchema>;
