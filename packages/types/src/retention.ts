/**
 * Churn Recovery (Phase 7 Sprint F, Unit 7.3).
 *
 * Stay Quotient scores churn risk; a retention campaign is one recorded attempt
 * to act on it. Default posture is DRY_RUN — an attempt is computed and stored
 * for admin review, but NO user is messaged until RETENTION_OUTREACH_LIVE is on.
 * Rows on the wire carry ISO-8601 timestamp strings.
 */

/** Mirrors the Stay Quotient StayRiskBand. */
export type RetentionRiskBand = 'low' | 'medium' | 'high' | 'critical';

export type RetentionActionType =
  | 'WINBACK_OFFER'
  | 'RECOVERY_NUDGE'
  | 'REENGAGE_MATCHES';

export type RetentionStatus =
  | 'DRY_RUN'
  | 'QUEUED'
  | 'SENT'
  | 'CONVERTED'
  | 'EXPIRED'
  | 'SUPPRESSED';

export interface RetentionCampaign {
  id:               string;
  userId:           string;
  riskBand:         RetentionRiskBand;
  churnProbability: number;   // 0..1
  primarySignal:    string | null;
  actionType:       RetentionActionType;
  channel:          string | null;
  status:           RetentionStatus;
  sentAt:           string | null;
  convertedAt:      string | null;
  expiresAt:        string;
  modelVersion:     string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface RetentionStats {
  total:          number;
  byStatus:       Record<RetentionStatus, number>;
  byBand:         Record<RetentionRiskBand, number>;
  /** converted / (sent + converted); 0 when no eligible attempts yet. */
  conversionRate: number;
}
