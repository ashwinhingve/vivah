export const MatchStatus = {
  PENDING:   'PENDING',
  ACCEPTED:  'ACCEPTED',
  DECLINED:  'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
  BLOCKED:   'BLOCKED',
} as const;
export type MatchStatus = typeof MatchStatus[keyof typeof MatchStatus];

export interface CompatibilityBreakdown {
  demographicAlignment:   { score: number; max: 20 }
  lifestyleCompatibility: { score: number; max: 15 }
  careerEducation:        { score: number; max: 15 }
  familyValues:           { score: number; max: 15 }
  preferenceOverlap:      { score: number; max: 20 }
  personalityFit:         { score: number; max: 15 }
}

export interface MatchExplainer {
  reasons: string[]   // length 0..3
  caveat: string | null
}

import type { ManglikStatus } from './profile.js';

export type DoshaSeverity = 'none' | 'low' | 'medium' | 'high';
export type FactorStatus = 'excellent' | 'good' | 'average' | 'low' | 'neutral';
export type DomainBand = 'excellent' | 'good' | 'average' | 'low';

export interface GunaFactorDetail {
  score:      number
  max:        number
  compatible: boolean
  name:       string
  nameHi:     string
  domain:     string
  meaning:    string
  status:     FactorStatus
  boyValue?:  string | null
  girlValue?: string | null
  axis?:      string | null
}

export interface GunaBreakdown {
  varna:       GunaFactorDetail
  vashya:      GunaFactorDetail
  tara:        GunaFactorDetail
  yoni:        GunaFactorDetail
  grahaMaitri: GunaFactorDetail
  gana:        GunaFactorDetail
  bhakoot:     GunaFactorDetail
  nadi:        GunaFactorDetail
}

export interface ManglikDosha {
  boyStatus:  ManglikStatus
  girlStatus: ManglikStatus
  conflict:   boolean
  cancelled:  boolean
  severity:   DoshaSeverity
  reason:     string
}

export interface NadiDosha {
  sameNadi:  boolean
  dosha:     boolean
  cancelled: boolean
  severity:  DoshaSeverity
  reason:    string
  boyNadi?:  string | null
  girlNadi?: string | null
}

export interface BhakootDosha {
  dosha:     boolean
  cancelled: boolean
  severity:  DoshaSeverity
  axis?:     string | null
  reason:    string
}

export interface RajjuDosha {
  dosha:     boolean
  boyRajju?: string | null
  girlRajju?:string | null
  severity:  DoshaSeverity
  reason:    string
}

export interface VedhaDosha {
  dosha:    boolean
  severity: DoshaSeverity
  reason:   string
}

export interface GanaDosha {
  dosha:     boolean
  cancelled: boolean
  severity:  DoshaSeverity
  reason:    string
  boyGana?:  string | null
  girlGana?: string | null
}

export interface DoshaSummary {
  manglik: ManglikDosha
  nadi:    NadiDosha
  bhakoot: BhakootDosha
  rajju:   RajjuDosha
  vedha:   VedhaDosha
  gana:    GanaDosha
}

export interface MahendraYoga {
  present: boolean
  count:   number | null
  reason:  string
}

export interface StreeDeerghaYoga {
  present: boolean
  count:   number | null
  reason:  string
}

export interface YogasSummary {
  mahendra:     MahendraYoga
  streeDeergha: StreeDeerghaYoga
}

export interface DomainInsight {
  score:   number   // 0–100
  label:   DomainBand
  summary: string
}

export interface InsightsSummary {
  mental:     DomainInsight
  physical:   DomainInsight
  prosperity: DomainInsight
  progeny:    DomainInsight
  longevity:  DomainInsight
}

export interface Remedy {
  code:        string
  dosha:       string
  name:        string
  description: string
  severity:    DoshaSeverity
}

export interface GunaResult {
  totalScore:          number   // 0–36
  maxScore:            36
  percentage:          number
  factors:             GunaBreakdown
  doshas:              DoshaSummary
  yogas:               YogasSummary
  insights:            InsightsSummary
  remedies:            Remedy[]
  blockingDosha:       boolean
  mangalDoshaConflict: boolean   // legacy field
  interpretation:      'Excellent match' | 'Good match' | 'Average match' | 'Not recommended'
  recommendation:      string
}

export interface CompatibilityScore {
  totalScore: number   // 0–100
  breakdown:  CompatibilityBreakdown
  gunaScore:  number   // 0–36, from GunaResult
  tier:       'excellent' | 'good' | 'average' | 'low'
  flags:      string[]
}

export interface MatchFeedItem {
  profileId:          string
  name:               string
  age:                number | null
  city:               string
  compatibility:      CompatibilityScore
  photoKey:           string | null
  isNew:              boolean
  isVerified:         boolean
  photoHidden:        boolean
  shortlisted:        boolean
  manglik?:           'YES' | 'NO' | 'PARTIAL' | null
  lastActiveAt?:      string | null
  isBoosted?:         boolean
  premiumTier?:       'FREE' | 'STANDARD' | 'PREMIUM'
  distanceKm?:        number | null
  explainer?:         MatchExplainer | null
}

export type MatchRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'BLOCKED'
  | 'EXPIRED';

export type MatchRequestPriority = 'NORMAL' | 'SUPER_LIKE';

export type DeclineReason =
  | 'NOT_INTERESTED' | 'NOT_MATCHING_PREFERENCES' | 'INCOMPLETE_PROFILE'
  | 'PHOTO_HIDDEN' | 'INAPPROPRIATE_MESSAGE' | 'OTHER';

export type ReportCategory =
  | 'HARASSMENT' | 'FAKE_PROFILE' | 'INAPPROPRIATE_CONTENT'
  | 'SCAM' | 'UNDERAGE' | 'SPAM' | 'OTHER';

export interface MatchRequest {
  id:                string;
  senderId:          string;
  receiverId:        string;
  status:            MatchRequestStatus;
  priority:          MatchRequestPriority;
  message:           string | null;
  acceptanceMessage: string | null;
  declineReason:     string | null;
  seenAt:            string | null;
  respondedAt:       string | null;
  expiresAt:         string | null;
  createdAt:         string;
  updatedAt:         string;
}

export interface EnrichedMatchRequest {
  id:                string;
  status:            MatchRequestStatus;
  priority:          MatchRequestPriority;
  message:           string | null;
  acceptanceMessage: string | null;
  declineReason:     string | null;
  seenAt:            string | null;
  respondedAt:       string | null;
  expiresAt:         string | null;
  createdAt:         string;
  profileId:         string;
  /** Counterparty's Better Auth user.id — needed for /safety-unlock and /contact. */
  userId:            string | null;
  name:              string | null;
  age:               number | null;
  city:              string | null;
  primaryPhotoKey:   string | null;
  isVerified:        boolean;
  manglik:           'YES' | 'NO' | 'PARTIAL' | null;
  lastActiveAt:      string | null;
}

export interface MatchRequestsResponse {
  requests: MatchRequest[];
  total:    number;
}

export interface EnrichedMatchRequestsResponse {
  requests: EnrichedMatchRequest[];
  total:    number;
}

export interface BlockedUser {
  blockId:         string;
  profileId:       string;
  name:            string | null;
  primaryPhotoKey: string | null;
  reason:          string | null;
  blockedAt:       string;
}

export type AllowMessageFrom = 'EVERYONE' | 'VERIFIED_ONLY' | 'SAME_COMMUNITY' | 'ACCEPTED_ONLY';
export type PrivacyPreset = 'CONSERVATIVE' | 'BALANCED' | 'OPEN';

export interface SafetyMode {
  contactHidden?:        boolean;
  photoHidden?:          boolean;
  incognito?:            boolean;
  showLastActive?:       boolean;
  showReadReceipts?:     boolean;
  photoBlurUntilUnlock?: boolean;
  hideFromSearch?:       boolean;
  allowMessageFrom?:     AllowMessageFrom;
}
