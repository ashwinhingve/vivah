/**
 * Smart Shaadi — Marketing Engine Service (Unit 6.4, Sprint J)
 *
 * Campaign CRUD + dispatch + sweep + attribution. The single send path is
 * dispatchToUser, used by both event dispatch and sweep workers.
 *
 * Lifecycle transitions: DRAFT → APPROVED → ACTIVE → (PAUSED ↔ ACTIVE) → COMPLETED.
 * Send lifecycle: QUEUED → SENT → (CONVERTED | SUPPRESSED | FAILED).
 */

import { and, desc, eq, inArray, gte, sql, isNotNull } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { queueNotification } from '../infrastructure/redis/queues.js';
import {
  marketingCampaigns,
  campaignContent,
  campaignSends,
  profiles,
  bookings,
  notificationPreferences,
} from '@smartshaadi/db';
import { isMarketingAutomationEnabled } from '../lib/env.js';
import { evaluateSegment } from './segments.js';
import type {
  MarketingCampaign,
  CampaignStats,
  MarketingOverviewStats,
  MarketingSegmentKey,
  MarketingCampaignStatus,
  CampaignSendStatus,
  CampaignSuppressedReason,
  MarketingConversionGoal,
  MarketingChannel,
  MarketingEventHookKey,
} from '@smartshaadi/types';

type CampaignRow = typeof marketingCampaigns.$inferSelect;

function iso(v: Date | string | null): string | null {
  if (v === null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function toCampaign(row: CampaignRow): MarketingCampaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.triggerType,
    segmentKey: row.segmentKey,
    channelSet: ((row.channelSet as unknown as string[]) ?? ['inapp']) as MarketingChannel[],
    status: row.status,
    templateKey: row.templateKey,
    scheduleConfig: (row.scheduleConfig as unknown as Record<string, unknown>) ?? null,
    eventHookKey: (row.eventHookKey ?? null) as MarketingEventHookKey | null,
    frequencyCapPerWeek: row.frequencyCapPerWeek,
    conversionGoal: row.conversionGoal,
    attributionWindowDays: row.attributionWindowDays,
    createdByUserId: row.createdByUserId,
    approvedByUserId: row.approvedByUserId,
    approvedAt: iso(row.approvedAt),
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  name: string;
  description?: string;
  triggerType: 'EVENT' | 'SCHEDULED' | 'SEGMENT_SWEEP';
  segmentKey: MarketingSegmentKey;
  channelSet?: string[];
  templateKey: string;
  scheduleConfig?: Record<string, unknown>;
  eventHookKey?: string;
  frequencyCapPerWeek?: number;
  conversionGoal?: MarketingConversionGoal;
  attributionWindowDays?: number;
  createdByUserId: string;
}

export async function createCampaign(input: CreateCampaignInput): Promise<MarketingCampaign> {
  const [inserted] = await db
    .insert(marketingCampaigns)
    .values({
      name: input.name,
      description: input.description ?? null,
      triggerType: input.triggerType,
      segmentKey: input.segmentKey,
      channelSet: input.channelSet ?? ['inapp'],
      status: 'DRAFT',
      templateKey: input.templateKey,
      scheduleConfig: input.scheduleConfig ?? null,
      eventHookKey: input.eventHookKey ?? null,
      frequencyCapPerWeek: input.frequencyCapPerWeek ?? 2,
      conversionGoal: input.conversionGoal ?? 'ANY',
      attributionWindowDays: input.attributionWindowDays ?? 14,
      createdByUserId: input.createdByUserId,
    })
    .returning();

  if (!inserted) throw new Error('Failed to create campaign');
  return toCampaign(inserted);
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  channelSet?: string[];
  scheduleConfig?: Record<string, unknown>;
  eventHookKey?: string;
  frequencyCapPerWeek?: number;
  conversionGoal?: MarketingConversionGoal;
  attributionWindowDays?: number;
}

export async function updateCampaign(
  campaignId: string,
  input: UpdateCampaignInput,
): Promise<MarketingCampaign | null> {
  // Only DRAFT and PAUSED campaigns are editable
  const [campaign] = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) return null;
  if (campaign.status !== 'DRAFT' && campaign.status !== 'PAUSED') {
    throw new Error(`Cannot edit ${campaign.status} campaign`);
  }

  const [updated] = await db
    .update(marketingCampaigns)
    .set({
      name: input.name ?? campaign.name,
      description: input.description !== undefined ? input.description : campaign.description,
      channelSet: input.channelSet ?? campaign.channelSet,
      scheduleConfig: input.scheduleConfig ?? campaign.scheduleConfig,
      eventHookKey: input.eventHookKey ?? campaign.eventHookKey,
      frequencyCapPerWeek: input.frequencyCapPerWeek ?? campaign.frequencyCapPerWeek,
      conversionGoal: input.conversionGoal ?? campaign.conversionGoal,
      attributionWindowDays: input.attributionWindowDays ?? campaign.attributionWindowDays,
      updatedAt: new Date(),
    })
    .where(eq(marketingCampaigns.id, campaignId))
    .returning();

  return updated ? toCampaign(updated) : null;
}

export async function getCampaign(campaignId: string): Promise<MarketingCampaign | null> {
  const [campaign] = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);
  return campaign ? toCampaign(campaign) : null;
}

export interface ListCampaignsInput {
  status?: MarketingCampaignStatus;
  limit: number;
  offset: number;
}

export async function listCampaigns(
  input: ListCampaignsInput,
): Promise<{ items: Array<MarketingCampaign & CampaignStats>; total: number }> {
  const filters = input.status ? [eq(marketingCampaigns.status, input.status)] : [];
  const where = filters.length ? and(...filters) : undefined;

  // Fetch campaigns with stats
  const [campaigns, totalRows] = await Promise.all([
    db
      .select()
      .from(marketingCampaigns)
      .where(where)
      .orderBy(desc(marketingCampaigns.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(marketingCampaigns)
      .where(where),
  ]);

  // Fetch stats for each campaign
  const campaignsWithStats = await Promise.all(
    campaigns.map(async (c) => {
      const stats = await getCampaignStats(c.id);
      return { ...toCampaign(c), ...stats };
    }),
  );

  return {
    items: campaignsWithStats,
    total: totalRows[0]?.n ?? 0,
  };
}

async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const rows = await db
    .select({
      status: campaignSends.status,
      n: sql<number>`count(*)::int`,
    })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId))
    .groupBy(campaignSends.status);

  const stats: CampaignStats = {
    campaignId,
    queued: 0,
    sent: 0,
    converted: 0,
    suppressed: 0,
    failed: 0,
    conversionRate: 0,
  };

  for (const row of rows) {
    if (row.status === 'QUEUED') stats.queued = row.n;
    else if (row.status === 'SENT') stats.sent = row.n;
    else if (row.status === 'CONVERTED') stats.converted = row.n;
    else if (row.status === 'SUPPRESSED') stats.suppressed = row.n;
    else if (row.status === 'FAILED') stats.failed = row.n;
  }

  const denom = stats.sent + stats.converted;
  stats.conversionRate = denom > 0 ? stats.converted / denom : 0;

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Transitions
// ─────────────────────────────────────────────────────────────────────────────

class TransitionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function approveCampaign(
  campaignId: string,
  approvedByUserId: string,
): Promise<MarketingCampaign> {
  const [campaign] = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) throw new TransitionError(404, 'Campaign not found');
  if (campaign.status !== 'DRAFT') {
    throw new TransitionError(409, `Cannot approve ${campaign.status} campaign`);
  }

  // Verify approved content exists for both languages
  const approvedContent = await db
    .select({ language: campaignContent.language })
    .from(campaignContent)
    .where(
      and(
        eq(campaignContent.campaignId, campaignId),
        eq(campaignContent.status, 'APPROVED'),
      ),
    );

  const hasEn = approvedContent.some((c) => c.language === 'en');
  const hasHi = approvedContent.some((c) => c.language === 'hi');
  if (!hasEn || !hasHi) {
    throw new TransitionError(422, 'Campaign requires approved content in both en and hi');
  }

  const [updated] = await db
    .update(marketingCampaigns)
    .set({
      status: 'APPROVED',
      approvedByUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(marketingCampaigns.id, campaignId), eq(marketingCampaigns.status, 'DRAFT')))
    .returning();

  if (!updated) throw new TransitionError(409, 'Campaign status changed unexpectedly');
  return toCampaign(updated);
}

export async function activateCampaign(campaignId: string): Promise<MarketingCampaign> {
  const [updated] = await db
    .update(marketingCampaigns)
    .set({ status: 'ACTIVE', updatedAt: new Date() })
    .where(and(eq(marketingCampaigns.id, campaignId), eq(marketingCampaigns.status, 'APPROVED')))
    .returning();

  if (!updated) throw new TransitionError(409, 'Campaign must be APPROVED to activate');
  return toCampaign(updated);
}

export async function pauseCampaign(campaignId: string): Promise<MarketingCampaign> {
  const [updated] = await db
    .update(marketingCampaigns)
    .set({ status: 'PAUSED', updatedAt: new Date() })
    .where(and(eq(marketingCampaigns.id, campaignId), eq(marketingCampaigns.status, 'ACTIVE')))
    .returning();

  if (!updated) throw new TransitionError(409, 'Campaign must be ACTIVE to pause');
  return toCampaign(updated);
}

export async function resumeCampaign(campaignId: string): Promise<MarketingCampaign> {
  const [updated] = await db
    .update(marketingCampaigns)
    .set({ status: 'ACTIVE', updatedAt: new Date() })
    .where(and(eq(marketingCampaigns.id, campaignId), eq(marketingCampaigns.status, 'PAUSED')))
    .returning();

  if (!updated) throw new TransitionError(409, 'Campaign must be PAUSED to resume');
  return toCampaign(updated);
}

export async function completeCampaign(campaignId: string): Promise<MarketingCampaign> {
  const [updated] = await db
    .update(marketingCampaigns)
    .set({ status: 'COMPLETED', updatedAt: new Date() })
    .where(
      and(
        eq(marketingCampaigns.id, campaignId),
        inArray(marketingCampaigns.status, ['ACTIVE', 'PAUSED']),
      ),
    )
    .returning();

  if (!updated) {
    throw new TransitionError(409, 'Campaign must be ACTIVE or PAUSED to complete');
  }
  return toCampaign(updated);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch & Send Path
// ─────────────────────────────────────────────────────────────────────────────

interface DispatchResult {
  inserted: boolean;
  status: CampaignSendStatus;
  reason?: CampaignSuppressedReason;
}

export async function dispatchToUser(
  campaign: CampaignRow,
  userId: string,
  userLocale: 'en' | 'hi' = 'en',
  // Injected so the "off" path is testable (Sprint G lesson: a module-level
  // const flag makes the on/off behavior untestable in-process).
  opts?: { automationEnabled?: boolean },
): Promise<DispatchResult> {
  const automationEnabled = opts?.automationEnabled ?? isMarketingAutomationEnabled;
  // 1. Kill-switch check
  if (!automationEnabled) {
    await recordSuppressed(campaign.id, userId, 'KILL_SWITCH');
    return { inserted: true, status: 'SUPPRESSED', reason: 'KILL_SWITCH' };
  }

  // 2. Consent check
  const [prefs] = await db
    .select({ marketing: notificationPreferences.marketing })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (!prefs?.marketing) {
    await recordSuppressed(campaign.id, userId, 'NO_MARKETING_CONSENT');
    return { inserted: true, status: 'SUPPRESSED', reason: 'NO_MARKETING_CONSENT' };
  }

  // 3. Frequency cap check via Redis
  const isoYearWeek = getISOYearWeek();
  const capKey = `mkt:cap:${userId}:${isoYearWeek}`;
  let capCount = await redis.incr(capKey);
  if (capCount === 1) {
    // First increment in this week; set expiry to 8 days
    await redis.expire(capKey, 8 * 24 * 60 * 60);
  }

  if (capCount > campaign.frequencyCapPerWeek) {
    // Cap exceeded; decrement back and suppress
    await redis.decr(capKey);
    await recordSuppressed(campaign.id, userId, 'FREQUENCY_CAP');
    return { inserted: true, status: 'SUPPRESSED', reason: 'FREQUENCY_CAP' };
  }

  // 4. Insert campaign_sends with dedup (onConflictDoNothing on the partial unique index)
  try {
    const now = new Date();
    const [send] = await db
      .insert(campaignSends)
      .values({
        campaignId: campaign.id,
        userId,
        status: 'QUEUED',
        createdAt: now,
        updatedAt: now,
      })
      // NO conflict target: the dedup index is PARTIAL (WHERE status IN
      // ('QUEUED','SENT','CONVERTED')), and a plain column-list target cannot
      // be inferred against a partial index — Postgres rejects it with 42P10.
      // Targetless DO NOTHING handles every unique violation, which here can
      // only be the dedup index.
      .onConflictDoNothing()
      .returning();

    if (!send) {
      // Duplicate (already targeted via dedup index). Give back the cap slot
      // this attempt consumed — a skipped send must not eat weekly budget.
      await redis.decr(capKey).catch(() => undefined);
      return { inserted: false, status: 'QUEUED' };
    }

    // 5. Resolve approved content for user's locale
    let resolvedContent = await db
      .select()
      .from(campaignContent)
      .where(
        and(
          eq(campaignContent.campaignId, campaign.id),
          eq(campaignContent.language, userLocale),
          eq(campaignContent.status, 'APPROVED'),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!resolvedContent) {
      // No approved content for this locale; fall back to 'en'
      resolvedContent = await db
        .select()
        .from(campaignContent)
        .where(
          and(
            eq(campaignContent.campaignId, campaign.id),
            eq(campaignContent.language, 'en'),
            eq(campaignContent.status, 'APPROVED'),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
    }

    if (!resolvedContent) {
      // No content at all; mark FAILED
      await db
        .update(campaignSends)
        .set({ status: 'FAILED', updatedAt: new Date() })
        .where(eq(campaignSends.id, send.id));
      return { inserted: true, status: 'FAILED' };
    }

    // 6. Queue notification
    try {
      await queueNotification({
        userId,
        type: 'MARKETING_CAMPAIGN',
        payload: {
          campaignSendId: send.id,
          campaignId: campaign.id,
          subjectLine: resolvedContent.subjectLine,
          bodyShort: resolvedContent.bodyShort,
          ctaUrl: resolvedContent.ctaUrl,
          ctaText: resolvedContent.ctaText,
        },
      });

      // 7. Mark SENT with channel
      const [updated] = await db
        .update(campaignSends)
        .set({
          status: 'SENT',
          sentAt: new Date(),
          channelSent: 'inapp',
          contentId: resolvedContent.id,
          updatedAt: new Date(),
        })
        .where(eq(campaignSends.id, send.id))
        .returning();

      return { inserted: true, status: updated?.status ?? 'SENT' };
    } catch (qErr) {
      logger.warn({ err: qErr, userId, campaignId: campaign.id }, 'marketing_enqueue_failed');
      await db
        .update(campaignSends)
        .set({ status: 'FAILED', updatedAt: new Date() })
        .where(eq(campaignSends.id, send.id));
      return { inserted: true, status: 'FAILED' };
    }
  } catch (e) {
    logger.warn({ err: e, userId, campaignId: campaign.id }, 'marketing_dispatch_error');
    throw e;
  }
}

async function recordSuppressed(
  campaignId: string,
  userId: string,
  reason: CampaignSuppressedReason,
): Promise<void> {
  try {
    // SUPPRESSED rows sit OUTSIDE the partial dedup index, so ON CONFLICT
    // cannot dedupe them (42P10 with a target; targetless would never fire).
    // Check-then-insert instead: one recorded row per (campaign, user) is
    // enough telemetry — without this, a daily sweep would append a new
    // SUPPRESSED row for every consent-off user every day. The worst-case
    // race is one extra telemetry row; there is no correctness constraint.
    const [existing] = await db
      .select({ id: campaignSends.id })
      .from(campaignSends)
      .where(
        and(
          eq(campaignSends.campaignId, campaignId),
          eq(campaignSends.userId, userId),
        ),
      )
      .limit(1);
    if (existing) return;

    await db.insert(campaignSends).values({
      campaignId,
      userId,
      status: 'SUPPRESSED',
      suppressedReason: reason,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (e) {
    logger.warn({ err: e, userId, campaignId }, 'marketing_suppress_record_failed');
  }
}

/** Exported so tests can construct the exact Redis cap key the engine uses. */
export function getISOYearWeek(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayDiff = (now.getTime() - jan4.getTime()) / msPerDay;
  const weekNumber = Math.floor((dayDiff + jan4.getDay()) / 7) + 1;
  const year = now.getFullYear();
  return `${year}W${String(weekNumber).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sweep Operations
// ─────────────────────────────────────────────────────────────────────────────

export interface SweepResult {
  campaignsRun: number;
  sends: number;
  conversions: number;
}

export async function runDueCampaigns(now: Date = new Date()): Promise<SweepResult> {
  // Find ACTIVE campaigns
  const campaigns = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.status, 'ACTIVE'));

  let sends = 0;
  let conversions = 0;
  let campaignsRun = 0;

  for (const campaign of campaigns) {
    if (campaign.triggerType === 'SEGMENT_SWEEP') {
      // Evaluate segment and dispatch to each user
      const segmentKey = campaign.segmentKey as MarketingSegmentKey;
      try {
        const userIds = await evaluateSegment(segmentKey);
        for (const userId of userIds) {
          const result = await dispatchToUser(campaign, userId);
          if (result.inserted && result.status === 'SENT') sends++;
        }
        campaignsRun++;
      } catch (e) {
        logger.error({ err: e, campaignId: campaign.id }, 'segment_sweep_failed');
      }
    } else if (campaign.triggerType === 'SCHEDULED') {
      // Check schedule config
      const config = campaign.scheduleConfig as Record<string, unknown> | null;
      if (!config) continue;

      // Check if endAt has passed
      if (config.endAt) {
        const endAt = new Date(config.endAt as string);
        if (now >= endAt) {
          // Complete the campaign
          await completeCampaign(campaign.id);
          campaignsRun++;
          continue;
        }
      }

      // Check if startAt has arrived
      if (config.startAt) {
        const startAt = new Date(config.startAt as string);
        if (now < startAt) continue;
      }

      // Check frequency
      if (config.frequencyDays) {
        const lastSend = await db
          .select({ sentAt: campaignSends.sentAt })
          .from(campaignSends)
          .where(
            and(
              eq(campaignSends.campaignId, campaign.id),
              inArray(campaignSends.status, ['SENT', 'CONVERTED']),
            ),
          )
          .orderBy(desc(campaignSends.sentAt))
          .limit(1);

        if (lastSend.length > 0 && lastSend[0]?.sentAt) {
          const daysSinceLast =
            (now.getTime() - new Date(lastSend[0].sentAt).getTime()) / (24 * 60 * 60 * 1000);
          if (daysSinceLast < (config.frequencyDays as number)) continue;
        }
      }

      // Evaluate segment and dispatch
      const segmentKey = campaign.segmentKey as MarketingSegmentKey;
      try {
        const userIds = await evaluateSegment(segmentKey);
        for (const userId of userIds) {
          const result = await dispatchToUser(campaign, userId);
          if (result.inserted && result.status === 'SENT') sends++;
        }
        campaignsRun++;
      } catch (e) {
        logger.error({ err: e, campaignId: campaign.id }, 'scheduled_sweep_failed');
      }
    }
  }

  // Attribution sweep
  conversions = await attributeConversions(now);

  logger.info({ campaignsRun, sends, conversions }, 'marketing_sweep_complete');
  return { campaignsRun, sends, conversions };
}

export async function attributeConversions(now: Date = new Date()): Promise<number> {
  // Find SENT rows still inside their attribution window
  const sentRows = await db
    .select()
    .from(campaignSends)
    .where(
      and(
        eq(campaignSends.status, 'SENT'),
        isNotNull(campaignSends.sentAt),
      ),
    );

  let converted = 0;

  for (const send of sentRows) {
    if (!send.sentAt) continue;

    const [campaign] = await db
      .select()
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, send.campaignId))
      .limit(1);

    if (!campaign) continue;

    // Check if still in attribution window
    const sentDate = new Date(send.sentAt);
    const windowMs = campaign.attributionWindowDays * 24 * 60 * 60 * 1000;
    if (now.getTime() - sentDate.getTime() > windowMs) continue;

    // Check conversion goal
    let hasConverted = false;
    let matchedAt: Date | null = null;

    if (campaign.conversionGoal === 'PROFILE_COMPLETED') {
      const [profile] = await db
        .select({ profileCompleteness: profiles.profileCompleteness, updatedAt: profiles.updatedAt })
        .from(profiles)
        .where(eq(profiles.userId, send.userId))
        .limit(1);

      if (profile && profile.profileCompleteness !== null && profile.profileCompleteness >= 80 && profile.updatedAt && profile.updatedAt > sentDate) {
        hasConverted = true;
        matchedAt = profile.updatedAt;
      }
    } else if (campaign.conversionGoal === 'BOOKING_CREATED') {
      const [booking] = await db
        .select({ createdAt: bookings.createdAt })
        .from(bookings)
        .where(eq(bookings.customerId, send.userId))
        .orderBy(desc(bookings.createdAt))
        .limit(1);

      if (booking && booking.createdAt && booking.createdAt > sentDate) {
        hasConverted = true;
        matchedAt = booking.createdAt;
      }
    } else if (campaign.conversionGoal === 'SUBSCRIPTION_STARTED') {
      // Documented no-op for now (subscriptions are mock-gated)
      continue;
    } else if (campaign.conversionGoal === 'ANY') {
      const [profile] = await db
        .select({ lastActiveAt: profiles.lastActiveAt })
        .from(profiles)
        .where(eq(profiles.userId, send.userId))
        .limit(1);

      if (profile && profile.lastActiveAt && profile.lastActiveAt > sentDate) {
        hasConverted = true;
        matchedAt = profile.lastActiveAt;
      }
    }

    if (hasConverted) {
      await db
        .update(campaignSends)
        .set({
          status: 'CONVERTED',
          convertedAt: matchedAt,
          conversionDetails: { goal: campaign.conversionGoal, matchedAt: matchedAt?.toISOString() },
          updatedAt: new Date(),
        })
        .where(eq(campaignSends.id, send.id));
      converted++;
    }
  }

  return converted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Stats
// ─────────────────────────────────────────────────────────────────────────────

export async function getOverviewStats(): Promise<MarketingOverviewStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Count active/draft campaigns
  const campaigns = await db
    .select({ status: marketingCampaigns.status, n: sql<number>`count(*)::int` })
    .from(marketingCampaigns)
    .where(inArray(marketingCampaigns.status, ['ACTIVE', 'DRAFT']))
    .groupBy(marketingCampaigns.status);

  let campaignsActive = 0;
  let campaignsDraft = 0;
  for (const c of campaigns) {
    if (c.status === 'ACTIVE') campaignsActive = c.n;
    else if (c.status === 'DRAFT') campaignsDraft = c.n;
  }

  // 30-day rollups
  const sends = await db
    .select({ status: campaignSends.status, n: sql<number>`count(*)::int` })
    .from(campaignSends)
    .where(gte(campaignSends.createdAt, thirtyDaysAgo))
    .groupBy(campaignSends.status);

  let sentLast30d = 0;
  let convertedLast30d = 0;
  let suppressedLast30d = 0;
  for (const s of sends) {
    if (s.status === 'SENT') sentLast30d = s.n;
    else if (s.status === 'CONVERTED') convertedLast30d = s.n;
    else if (s.status === 'SUPPRESSED') suppressedLast30d = s.n;
  }

  const conversionRate30d = sentLast30d + convertedLast30d > 0
    ? convertedLast30d / (sentLast30d + convertedLast30d)
    : 0;

  // By segment
  const bySegment = await db
    .select({
      segmentKey: marketingCampaigns.segmentKey,
      sent: sql<number>`count(case when campaign_sends.status = 'SENT' then 1 end)`,
      converted: sql<number>`count(case when campaign_sends.status = 'CONVERTED' then 1 end)`,
    })
    .from(marketingCampaigns)
    .innerJoin(campaignSends, eq(campaignSends.campaignId, marketingCampaigns.id))
    .where(gte(campaignSends.createdAt, thirtyDaysAgo))
    .groupBy(marketingCampaigns.segmentKey);

  // By channel
  const byChannel = await db
    .select({
      channel: campaignSends.channelSent,
      sent: sql<number>`count(*)`,
    })
    .from(campaignSends)
    .where(
      and(
        gte(campaignSends.createdAt, thirtyDaysAgo),
        eq(campaignSends.status, 'SENT'),
      ),
    )
    .groupBy(campaignSends.channelSent);

  return {
    campaignsActive,
    campaignsDraft,
    sentLast30d,
    convertedLast30d,
    suppressedLast30d,
    conversionRate30d,
    bySegment: bySegment as Array<{ segmentKey: string; sent: number; converted: number }>,
    byChannel: byChannel.filter((c) => c.channel) as Array<{ channel: MarketingChannel; sent: number }>,
  };
}
