/**
 * Churn-recovery service (Unit 7.3).
 *
 * Stay Quotient scores churn; this records + acts on it. Every high/critical
 * at-risk user gets at most one OPEN recovery attempt (enforced by a partial
 * unique index). Default posture is DRY_RUN — the attempt is stored for admin
 * review with NO user messaged — until RETENTION_OUTREACH_LIVE flips it to a
 * real win-back notification. Conversion = the user became active again after
 * the attempt was sent.
 */
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { retentionCampaigns, profiles } from '@smartshaadi/db';
import { queueNotification } from '../infrastructure/redis/queues.js';
import type { StayQuotientResponse } from '../services/stayService.js';
import type {
  RetentionActionType, RetentionCampaign, RetentionStats, RetentionStatus,
} from '@smartshaadi/types';

const ATTEMPT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Statuses that count as an "open" attempt (matches the DB partial unique index). */
const OPEN_STATUSES = ['DRY_RUN', 'QUEUED', 'SENT'] as const;

/** Map the Stay Quotient recommended_action string → our action taxonomy. */
export function mapAction(recommendedAction: string): RetentionActionType {
  const a = recommendedAction.toLowerCase();
  if (a.includes('winback') || a.includes('offer') || a.includes('incentive')) return 'WINBACK_OFFER';
  if (a.includes('match') || a.includes('reengage') || a.includes('re-engage')) return 'REENGAGE_MATCHES';
  return 'RECOVERY_NUDGE';
}

/** Notification job type for each action. */
function notificationType(action: RetentionActionType): string {
  switch (action) {
    case 'WINBACK_OFFER':    return 'CHURN_WINBACK_OFFER';
    case 'REENGAGE_MATCHES': return 'REENGAGE_NUDGE';
    case 'RECOVERY_NUDGE':   return 'CHURN_RECOVERY_NUDGE';
  }
}

type Row = typeof retentionCampaigns.$inferSelect;

function iso(v: Date | string | null): string | null {
  if (v === null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function toCampaign(row: Row): RetentionCampaign {
  return {
    id:               row.id,
    userId:           row.userId,
    riskBand:         row.riskBand,
    churnProbability: row.churnProbability,
    primarySignal:    row.primarySignal,
    actionType:       row.actionType,
    channel:          row.channel,
    status:           row.status,
    sentAt:           iso(row.sentAt),
    convertedAt:      iso(row.convertedAt),
    expiresAt:        iso(row.expiresAt)!,
    modelVersion:     row.modelVersion,
    createdAt:        iso(row.createdAt)!,
    updatedAt:        iso(row.updatedAt)!,
  };
}

/**
 * Create a recovery attempt for one scored user, if none is already open.
 * When `sendOutreach` is true the win-back notification is enqueued and the row
 * is marked SENT; otherwise it is stored as DRY_RUN (no user messaged). Returns
 * the created campaign, or null if an open attempt already existed (idempotent).
 */
export async function createRecoveryAttempt(
  quotient: StayQuotientResponse,
  sendOutreach: boolean,
): Promise<RetentionCampaign | null> {
  const userId = quotient.user_id;

  // Fast path: skip if an open attempt already exists (the DB partial-unique
  // index is the hard guarantee; this avoids a guaranteed-failing insert).
  const existing = await db
    .select({ id: retentionCampaigns.id })
    .from(retentionCampaigns)
    .where(and(
      eq(retentionCampaigns.userId, userId),
      inArray(retentionCampaigns.status, [...OPEN_STATUSES]),
    ))
    .limit(1);
  if (existing.length > 0) return null;

  const action = mapAction(quotient.recommended_action);
  const status: RetentionStatus = sendOutreach ? 'SENT' : 'DRY_RUN';
  const now = new Date();

  let inserted: Row | undefined;
  try {
    const rows = await db.insert(retentionCampaigns).values({
      userId,
      riskBand:         quotient.risk_band,
      churnProbability: quotient.churn_probability,
      primarySignal:    quotient.primary_signal,
      actionType:       action,
      status,
      sentAt:           sendOutreach ? now : null,
      channel:          sendOutreach ? 'inapp' : null,
      expiresAt:        new Date(now.getTime() + ATTEMPT_TTL_MS),
      modelVersion:     quotient.model_version,
    }).returning();
    inserted = rows[0];
  } catch (e) {
    // Unique-violation race — another sweep created the open attempt first.
    logger.warn({ err: e, userId }, 'retention_attempt_insert_skipped');
    return null;
  }
  if (!inserted) return null;

  if (sendOutreach) {
    await queueNotification({
      userId,
      type:    notificationType(action),
      payload: { retentionCampaignId: inserted.id, riskBand: quotient.risk_band },
    }).catch((e: unknown) => {
      logger.warn({ err: e, userId }, 'retention_outreach_enqueue_failed');
    });
  }

  return toCampaign(inserted);
}

/**
 * Flip SENT attempts to CONVERTED when the user became active again after the
 * attempt was sent. Batch, bounded by the number of open SENT attempts.
 * Returns the number converted.
 */
export async function markConvertedForActiveUsers(): Promise<number> {
  const openSent = await db
    .select({ id: retentionCampaigns.id, sentAt: retentionCampaigns.sentAt, lastActiveAt: profiles.lastActiveAt })
    .from(retentionCampaigns)
    .innerJoin(profiles, eq(profiles.userId, retentionCampaigns.userId))
    .where(and(
      eq(retentionCampaigns.status, 'SENT'),
      gt(profiles.lastActiveAt, retentionCampaigns.sentAt),
    ));

  if (openSent.length === 0) return 0;
  const ids = openSent.map((r) => r.id);
  await db.update(retentionCampaigns)
    .set({ status: 'CONVERTED', convertedAt: new Date(), updatedAt: new Date() })
    .where(inArray(retentionCampaigns.id, ids));
  return ids.length;
}

/** Expire open attempts whose window has elapsed without conversion. */
export async function expireStaleAttempts(): Promise<number> {
  const rows = await db.update(retentionCampaigns)
    .set({ status: 'EXPIRED', updatedAt: new Date() })
    .where(and(
      inArray(retentionCampaigns.status, [...OPEN_STATUSES]),
      sql`${retentionCampaigns.expiresAt} < now()`,
    ))
    .returning({ id: retentionCampaigns.id });
  return rows.length;
}

// ── Admin queries ─────────────────────────────────────────────────────────────

export interface ListCampaignsInput {
  status?:   RetentionStatus | undefined;
  riskBand?: 'low' | 'medium' | 'high' | 'critical' | undefined;
  limit:     number;
  offset:    number;
}

export async function listCampaigns(
  input: ListCampaignsInput,
): Promise<{ items: RetentionCampaign[]; total: number }> {
  const filters = [];
  if (input.status)   filters.push(eq(retentionCampaigns.status, input.status));
  if (input.riskBand) filters.push(eq(retentionCampaigns.riskBand, input.riskBand));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.select().from(retentionCampaigns)
      .where(where)
      .orderBy(desc(retentionCampaigns.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ n: sql<number>`count(*)::int` }).from(retentionCampaigns).where(where),
  ]);

  return { items: rows.map(toCampaign), total: totalRows[0]?.n ?? 0 };
}

export async function getStats(): Promise<RetentionStats> {
  const rows = await db
    .select({ status: retentionCampaigns.status, riskBand: retentionCampaigns.riskBand, n: sql<number>`count(*)::int` })
    .from(retentionCampaigns)
    .groupBy(retentionCampaigns.status, retentionCampaigns.riskBand);

  const byStatus: RetentionStats['byStatus'] = {
    DRY_RUN: 0, QUEUED: 0, SENT: 0, CONVERTED: 0, EXPIRED: 0, SUPPRESSED: 0,
  };
  const byBand: RetentionStats['byBand'] = { low: 0, medium: 0, high: 0, critical: 0 };
  let total = 0;
  for (const r of rows) {
    byStatus[r.status] += r.n;
    byBand[r.riskBand] += r.n;
    total += r.n;
  }
  const denom = byStatus.SENT + byStatus.CONVERTED;
  const conversionRate = denom > 0 ? byStatus.CONVERTED / denom : 0;

  return { total, byStatus, byBand, conversionRate };
}
