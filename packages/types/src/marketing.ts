/**
 * Auto-Marketing Engine (Unit 6.4, Sprint J) — shared contracts.
 *
 * Campaign lifecycle: DRAFT → APPROVED → ACTIVE → (PAUSED ↔ ACTIVE) → COMPLETED.
 * Content lifecycle:  DRAFT → APPROVED (→ ARCHIVED). A campaign can only go
 * ACTIVE with APPROVED content for every language — that approval gate, not a
 * dry-run fork, is what keeps demo and launch behavior identical.
 * Send lifecycle:     QUEUED → SENT → (CONVERTED | stays SENT past window),
 * or SUPPRESSED (no marketing consent / frequency cap — reason recorded) /
 * FAILED. Segments are resolved lazily by SQL at sweep/send time.
 */

export type MarketingTriggerType = 'EVENT' | 'SCHEDULED' | 'SEGMENT_SWEEP';
export const MARKETING_TRIGGER_TYPES: readonly MarketingTriggerType[] =
  ['EVENT', 'SCHEDULED', 'SEGMENT_SWEEP'];

export type MarketingCampaignStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export const MARKETING_CAMPAIGN_STATUSES: readonly MarketingCampaignStatus[] =
  ['DRAFT', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED'];

export type CampaignSendStatus = 'QUEUED' | 'SENT' | 'CONVERTED' | 'SUPPRESSED' | 'FAILED';
export const CAMPAIGN_SEND_STATUSES: readonly CampaignSendStatus[] =
  ['QUEUED', 'SENT', 'CONVERTED', 'SUPPRESSED', 'FAILED'];

export type CampaignContentStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED';

export type MarketingConversionGoal =
  | 'PROFILE_COMPLETED'
  | 'BOOKING_CREATED'
  | 'SUBSCRIPTION_STARTED'
  | 'ANY';
export const MARKETING_CONVERSION_GOALS: readonly MarketingConversionGoal[] =
  ['PROFILE_COMPLETED', 'BOOKING_CREATED', 'SUBSCRIPTION_STARTED', 'ANY'];

/** Delivery channels — map 1:1 onto the existing notification pipeline. */
export type MarketingChannel = 'inapp' | 'email' | 'push' | 'sms' | 'whatsapp';
export const MARKETING_CHANNELS: readonly MarketingChannel[] =
  ['inapp', 'email', 'push', 'sms', 'whatsapp'];

export type MarketingLanguage = 'en' | 'hi';
export const MARKETING_LANGUAGES: readonly MarketingLanguage[] = ['en', 'hi'];

/** The launch segment set. Predicates live in apps/api marketing/segments.ts. */
export type MarketingSegmentKey =
  | 'new_incomplete_48h'   // registered <48h ago, profile still incomplete
  | 'inactive_14d'         // no activity for 14d (and account older than 30d)
  | 'high_intent_7d'       // recent views / match requests
  | 'vendors_new_7d'       // vendors approved in the last 7 days
  | 'vendors_idle_30d';    // approved vendors with no bookings in 30 days
export const MARKETING_SEGMENT_KEYS: readonly MarketingSegmentKey[] = [
  'new_incomplete_48h', 'inactive_14d', 'high_intent_7d',
  'vendors_new_7d', 'vendors_idle_30d',
];

/** Product events that can fire EVENT-triggered campaigns. */
export type MarketingEventHookKey = 'user_registered' | 'kyc_approved' | 'booking_created';
export const MARKETING_EVENT_HOOK_KEYS: readonly MarketingEventHookKey[] =
  ['user_registered', 'kyc_approved', 'booking_created'];

/** Reasons a send row lands SUPPRESSED instead of being delivered. */
export type CampaignSuppressedReason = 'NO_MARKETING_CONSENT' | 'FREQUENCY_CAP' | 'KILL_SWITCH';

export interface MarketingScheduleConfig {
  /** SCHEDULED: re-evaluate every N days (sweep enforces). */
  frequencyDays?: number;
  /** SCHEDULED: only fire within N days before an auspicious calendar event. */
  muhuratProximityDays?: number;
  /** EVENT: delay between the hook firing and the send (welcome D2/D7 series). */
  delayMinutes?: number;
  /** Earliest allowed send (ISO). */
  startAt?: string;
  /** Latest allowed send (ISO); after this the sweep completes the campaign. */
  endAt?: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  description: string | null;
  triggerType: MarketingTriggerType;
  segmentKey: string;
  channelSet: MarketingChannel[];
  status: MarketingCampaignStatus;
  templateKey: string;
  scheduleConfig: MarketingScheduleConfig | null;
  eventHookKey: MarketingEventHookKey | null;
  frequencyCapPerWeek: number;
  conversionGoal: MarketingConversionGoal;
  attributionWindowDays: number;
  createdByUserId: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignContent {
  id: string;
  campaignId: string;
  templateKey: string;
  language: MarketingLanguage;
  status: CampaignContentStatus;
  subjectLine: string | null;
  bodyShort: string;
  bodyLong: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  generatedByLlm: boolean;
  generatedAt: string | null;
  modelVersion: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSend {
  id: string;
  campaignId: string;
  userId: string;
  status: CampaignSendStatus;
  channelSent: MarketingChannel | null;
  contentId: string | null;
  sentAt: string | null;
  convertedAt: string | null;
  conversionDetails: Record<string, unknown> | null;
  suppressedReason: CampaignSuppressedReason | null;
  createdAt: string;
  updatedAt: string;
}

/** Per-campaign rollup used by the admin dashboard table. */
export interface CampaignStats {
  campaignId: string;
  queued: number;
  sent: number;
  converted: number;
  suppressed: number;
  failed: number;
  /** converted / (sent + converted); 0 when nothing sent. */
  conversionRate: number;
}

/** Platform-wide KPI strip for /admin/marketing. */
export interface MarketingOverviewStats {
  campaignsActive: number;
  campaignsDraft: number;
  sentLast30d: number;
  convertedLast30d: number;
  suppressedLast30d: number;
  conversionRate30d: number;
  bySegment: Array<{ segmentKey: string; sent: number; converted: number }>;
  byChannel: Array<{ channel: MarketingChannel; sent: number }>;
}

/** ai-service POST /marketing/generate response shape (per language). */
export interface GeneratedCampaignCopy {
  subjectLine: string;
  bodyShort: string;
  bodyLong: string;
  ctaText: string;
}

export interface GeneratedCampaignContent {
  en: GeneratedCampaignCopy;
  hi: GeneratedCampaignCopy;
  modelVersion: string;
}
