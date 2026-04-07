export const KycErrorCode = {
  PROFILE_NOT_FOUND:           'PROFILE_NOT_FOUND',
  KYC_ALREADY_VERIFIED:        'KYC_ALREADY_VERIFIED',
  KYC_IN_REVIEW:               'KYC_IN_REVIEW',
  KYC_REJECTED:                'KYC_REJECTED',
  DUPLICATE_ACCOUNT_DETECTED:  'DUPLICATE_ACCOUNT_DETECTED',
  PHOTO_FRAUD_DETECTED:        'PHOTO_FRAUD_DETECTED',
  AADHAAR_VERIFICATION_FAILED: 'AADHAAR_VERIFICATION_FAILED',
} as const;

export type KycErrorCode = typeof KycErrorCode[keyof typeof KycErrorCode];

export interface PhotoAnalysis {
  isRealPerson:     boolean;
  confidenceScore:  number;
  hasSunglasses:    boolean;
  multipleFaces:    boolean;
  analyzedAt:       string; // ISO 8601
}

export interface AadhaarVerificationResult {
  verified: boolean;
  refId:    string;
  // name intentionally omitted — callers must NOT persist it
}

export interface KycStatusResponse {
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
  aadhaarVerified:    boolean;
  duplicateFlag:      boolean;
  photoAnalysis:      PhotoAnalysis | null;
  adminNote:          string | null;
}
