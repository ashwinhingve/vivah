/**
 * Auto-Marketing Engine (Unit 6.4, Sprint J) — Zod validation.
 * Shapes mirror packages/types/src/marketing.ts exactly.
 */
import { z } from 'zod';

export const MarketingTriggerTypeSchema = z.enum(['EVENT', 'SCHEDULED', 'SEGMENT_SWEEP']);
export const MarketingCampaignStatusSchema = z.enum(['DRAFT', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED']);
export const CampaignSendStatusSchema = z.enum(['QUEUED', 'SENT', 'CONVERTED', 'SUPPRESSED', 'FAILED']);
export const MarketingChannelSchema = z.enum(['inapp', 'email', 'push', 'sms', 'whatsapp']);
export const MarketingConversionGoalSchema = z.enum(['PROFILE_COMPLETED', 'BOOKING_CREATED', 'SUBSCRIPTION_STARTED', 'ANY']);
export const MarketingLanguageSchema = z.enum(['en', 'hi']);
export const MarketingSegmentKeySchema = z.enum([
  'new_incomplete_48h', 'inactive_14d', 'high_intent_7d', 'vendors_new_7d', 'vendors_idle_30d',
]);
export const MarketingEventHookKeySchema = z.enum(['user_registered', 'kyc_approved', 'booking_created']);

export const MarketingScheduleConfigSchema = z.object({
  frequencyDays:        z.number().int().min(1).max(365).optional(),
  muhuratProximityDays: z.number().int().min(1).max(60).optional(),
  delayMinutes:         z.number().int().min(0).max(60 * 24 * 30).optional(),
  startAt:              z.string().datetime().optional(),
  endAt:                z.string().datetime().optional(),
}).strict();

export const CreateMarketingCampaignSchema = z.object({
  name:                  z.string().trim().min(3).max(255),
  description:           z.string().trim().max(2000).optional(),
  triggerType:           MarketingTriggerTypeSchema,
  segmentKey:            MarketingSegmentKeySchema,
  channelSet:            z.array(MarketingChannelSchema).min(1).max(5),
  templateKey:           z.string().trim().min(1).max(100),
  scheduleConfig:        MarketingScheduleConfigSchema.optional(),
  eventHookKey:          MarketingEventHookKeySchema.optional(),
  frequencyCapPerWeek:   z.number().int().min(0).max(14).default(2),
  conversionGoal:        MarketingConversionGoalSchema.default('ANY'),
  attributionWindowDays: z.number().int().min(1).max(90).default(14),
}).superRefine((val, ctx) => {
  if (val.triggerType === 'EVENT' && !val.eventHookKey) {
    ctx.addIssue({ code: 'custom', path: ['eventHookKey'], message: 'EVENT campaigns need an eventHookKey' });
  }
  if (val.triggerType !== 'EVENT' && val.eventHookKey) {
    ctx.addIssue({ code: 'custom', path: ['eventHookKey'], message: 'eventHookKey is only valid for EVENT campaigns' });
  }
});

export const UpdateMarketingCampaignSchema = z.object({
  name:                  z.string().trim().min(3).max(255).optional(),
  description:           z.string().trim().max(2000).nullable().optional(),
  channelSet:            z.array(MarketingChannelSchema).min(1).max(5).optional(),
  scheduleConfig:        MarketingScheduleConfigSchema.nullable().optional(),
  frequencyCapPerWeek:   z.number().int().min(0).max(14).optional(),
  conversionGoal:        MarketingConversionGoalSchema.optional(),
  attributionWindowDays: z.number().int().min(1).max(90).optional(),
}).strict();

/** Explicit lifecycle transitions — the router exposes these, not a free status PATCH. */
export const CampaignTransitionSchema = z.object({
  action: z.enum(['approve', 'activate', 'pause', 'resume', 'complete']),
});

export const MarketingCampaignsQuerySchema = z.object({
  status: MarketingCampaignStatusSchema.optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CampaignSendsQuerySchema = z.object({
  status: CampaignSendStatusSchema.optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GenerateContentSchema = z.object({
  /** Optional brief to steer the copy; the campaign row supplies the rest. */
  brief: z.string().trim().max(1000).optional(),
});

export const ApproveContentSchema = z.object({
  contentId: z.string().uuid(),
});

/** Manual copy authoring/override (both languages land as DRAFT). */
export const UpsertContentSchema = z.object({
  language:    MarketingLanguageSchema,
  subjectLine: z.string().trim().max(255).optional(),
  bodyShort:   z.string().trim().min(1).max(500),
  bodyLong:    z.string().trim().max(5000).optional(),
  ctaText:     z.string().trim().max(100).optional(),
  ctaUrl:      z.string().trim().max(500).optional(),
});
