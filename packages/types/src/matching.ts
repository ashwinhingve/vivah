export const MatchStatus = {
  PENDING:   'PENDING',
  ACCEPTED:  'ACCEPTED',
  DECLINED:  'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
  BLOCKED:   'BLOCKED',
} as const;
export type MatchStatus = typeof MatchStatus[keyof typeof MatchStatus];

export interface CompatibilityBreakdown {
  demographicAlignment:   { score: number; max: 25 }
  lifestyleCompatibility: { score: number; max: 20 }
  careerEducation:        { score: number; max: 15 }
  familyValues:           { score: number; max: 20 }
  preferenceOverlap:      { score: number; max: 20 }
}

export interface GunaBreakdown {
  varna:       { score: number; max: 1;  compatible: boolean }
  vashya:      { score: number; max: 2;  compatible: boolean }
  tara:        { score: number; max: 3;  compatible: boolean }
  yoni:        { score: number; max: 4;  compatible: boolean }
  grahaMaitri: { score: number; max: 5;  compatible: boolean }
  gana:        { score: number; max: 6;  compatible: boolean }
  bhakoot:     { score: number; max: 7;  compatible: boolean }
  nadi:        { score: number; max: 8;  compatible: boolean }
}

export interface GunaResult {
  totalScore:          number   // 0–36
  maxScore:            36
  percentage:          number
  factors:             GunaBreakdown
  mangalDoshaConflict: boolean
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
  profileId:     string
  name:          string
  age:           number | null
  city:          string
  compatibility: CompatibilityScore
  photoKey:      string | null
  isNew:         boolean
}

export type MatchRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'BLOCKED'
  | 'EXPIRED';

export interface MatchRequest {
  id:           string;
  senderId:     string;
  receiverId:   string;
  status:       MatchRequestStatus;
  message:      string | null;
  respondedAt:  string | null;
  expiresAt:    string | null;
  createdAt:    string;
  updatedAt:    string;
}

export interface MatchRequestsResponse {
  requests: MatchRequest[];
  total:    number;
}
