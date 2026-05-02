export const KycErrorCode = {
  PROFILE_NOT_FOUND:           'PROFILE_NOT_FOUND',
  KYC_ALREADY_VERIFIED:        'KYC_ALREADY_VERIFIED',
  KYC_IN_REVIEW:               'KYC_IN_REVIEW',
  KYC_REJECTED:                'KYC_REJECTED',
  KYC_LOCKED:                  'KYC_LOCKED',
  KYC_EXPIRED:                 'KYC_EXPIRED',
  DUPLICATE_ACCOUNT_DETECTED:  'DUPLICATE_ACCOUNT_DETECTED',
  PHOTO_FRAUD_DETECTED:        'PHOTO_FRAUD_DETECTED',
  AADHAAR_VERIFICATION_FAILED: 'AADHAAR_VERIFICATION_FAILED',
  PAN_VERIFICATION_FAILED:     'PAN_VERIFICATION_FAILED',
  BANK_VERIFICATION_FAILED:    'BANK_VERIFICATION_FAILED',
  LIVENESS_FAILED:             'LIVENESS_FAILED',
  FACE_MATCH_FAILED:           'FACE_MATCH_FAILED',
  SANCTIONS_HIT:               'SANCTIONS_HIT',
  DOCUMENT_INVALID:            'DOCUMENT_INVALID',
  RATE_LIMITED:                'RATE_LIMITED',
  APPEAL_NOT_ALLOWED:          'APPEAL_NOT_ALLOWED',
  APPEAL_ALREADY_PENDING:      'APPEAL_ALREADY_PENDING',
  REVERIFY_NOT_ALLOWED:        'REVERIFY_NOT_ALLOWED',
} as const;

export type KycErrorCode = typeof KycErrorCode[keyof typeof KycErrorCode];

export type KycVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'MANUAL_REVIEW'
  | 'EXPIRED'
  | 'LOCKED'
  | 'INFO_REQUESTED';

export type KycLevel = 'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ELITE';

export type KycEventType =
  | 'INITIATED'
  | 'AADHAAR_VERIFIED'
  | 'AADHAAR_FAILED'
  | 'PHOTO_ANALYZED'
  | 'LIVENESS_CHECKED'
  | 'FACE_MATCH_CHECKED'
  | 'PAN_VERIFIED'
  | 'PAN_FAILED'
  | 'BANK_VERIFIED'
  | 'BANK_FAILED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_VERIFIED'
  | 'DOCUMENT_REJECTED'
  | 'SANCTIONS_CHECKED'
  | 'SANCTIONS_HIT'
  | 'CRIMINAL_CHECKED'
  | 'ADDRESS_VERIFIED'
  | 'EMPLOYMENT_VERIFIED'
  | 'EDUCATION_VERIFIED'
  | 'RISK_SCORED'
  | 'AUTO_VERIFIED'
  | 'AUTO_REJECTED'
  | 'MANUAL_APPROVED'
  | 'MANUAL_REJECTED'
  | 'INFO_REQUESTED'
  | 'INFO_PROVIDED'
  | 'APPEAL_FILED'
  | 'APPEAL_UPHELD'
  | 'APPEAL_DENIED'
  | 'REVERIFICATION_REQUESTED'
  | 'EXPIRED'
  | 'LOCKED'
  | 'UNLOCKED'
  | 'LEVEL_UPGRADED';

export type KycDocumentType =
  | 'AADHAAR'
  | 'PAN'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'DRIVING_LICENSE'
  | 'EMPLOYMENT_LETTER'
  | 'EDUCATION_CERTIFICATE'
  | 'BANK_STATEMENT'
  | 'UTILITY_BILL'
  | 'SELFIE'
  | 'LIVENESS_VIDEO'
  | 'OTHER';

export type KycDocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export type KycAppealStatus = 'PENDING' | 'UNDER_REVIEW' | 'UPHELD' | 'DENIED' | 'WITHDRAWN';

export interface PhotoAnalysis {
  isRealPerson:     boolean;
  confidenceScore:  number;
  hasSunglasses:    boolean;
  multipleFaces:    boolean;
  analyzedAt:       string; // ISO 8601
}

export interface LivenessResult {
  passed:        boolean;
  score:         number; // 0-100
  challengesPassed: string[]; // e.g. ['HEAD_TURN_LEFT','BLINK','HEAD_TURN_RIGHT']
  spoofIndicators: string[]; // e.g. ['SCREEN_REPLAY','PHOTO_HOLDUP','MASK']
  analyzedAt:    string;
}

export interface FaceMatchResult {
  matched:    boolean;
  score:      number; // 0-100, higher is more confident match
  analyzedAt: string;
}

export interface AadhaarVerificationResult {
  verified: boolean;
  refId:    string;
  // name intentionally omitted — callers must NOT persist it
}

export interface PanVerificationResult {
  verified: boolean;
  refId:    string;
  panLast4: string;
  // never expose full PAN, name, or DOB
}

export interface BankVerificationResult {
  verified:        boolean;
  refId:           string;
  accountLast4:    string;
  ifsc:            string;
  // bank name + holder name verified server-side, not returned to client
}

export interface SanctionsCheckResult {
  hit:           boolean;
  listsChecked:  string[]; // OFAC, UN, INTERPOL, RBI
  matchScore:    number;   // 0-100
  checkedAt:     string;
}

export interface CriminalCheckResult {
  cleared:   boolean;
  refId:     string;
  checkedAt: string;
}

export interface RiskFactor {
  code:   string;          // 'DUPLICATE_DEVICE' | 'LOW_LIVENESS' | …
  impact: number;          // negative = risk, positive = trust
  detail: string;
}

export interface RiskAssessment {
  score:        number;    // 0-100, 100 = lowest risk
  factors:      RiskFactor[];
  decision:     'AUTO_VERIFY' | 'MANUAL_REVIEW' | 'AUTO_REJECT';
  computedAt:   string;
}

export interface KycLevelRequirements {
  level:        KycLevel;
  required:     KycDocumentType[];
  features:     string[];        // user-facing benefits unlocked
  satisfiedBy:  string[];        // signals already met
  missing:      string[];        // signals still required
  unlocked:     boolean;
}

export interface KycStatusResponse {
  verificationStatus: KycVerificationStatus;
  verificationLevel:  KycLevel;
  aadhaarVerified:    boolean;
  panVerified:        boolean;
  bankVerified:       boolean;
  livenessScore:      number | null;
  faceMatchScore:     number | null;
  riskScore:          number | null;
  expiresAt:          string | null;
  attemptCount:       number;
  lockedUntil:        string | null;
  duplicateFlag:      boolean;
  photoAnalysis:      PhotoAnalysis | null;
  adminNote:          string | null;
}

export interface KycAuditEntry {
  id:         string;
  eventType:  KycEventType;
  actorRole:  'USER' | 'ADMIN' | 'SYSTEM' | null;
  fromStatus: KycVerificationStatus | null;
  toStatus:   KycVerificationStatus | null;
  fromLevel:  KycLevel | null;
  toLevel:    KycLevel | null;
  metadata:   Record<string, unknown> | null;
  createdAt:  string;
}

export interface KycDocumentSummary {
  id:           string;
  documentType: KycDocumentType;
  status:       KycDocumentStatus;
  documentLast4: string | null;
  expiresAt:    string | null;
  uploadedAt:   string;
  verifiedAt:   string | null;
  rejectionReason: string | null;
}

export interface KycAppealSummary {
  id:           string;
  status:       KycAppealStatus;
  userMessage:  string;
  resolverNote: string | null;
  createdAt:    string;
  resolvedAt:   string | null;
}
