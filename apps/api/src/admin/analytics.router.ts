/**
 * Admin Analytics router — platform growth & engagement aggregations.
 *
 * Powers the /admin/analytics dashboard. All data is read straight from
 * Postgres via existing tables — NO schema changes, NO new infra.
 *
 * Routes (all require an authenticated ADMIN session):
 *   GET /api/v1/admin/analytics/overview          KPI cards + MoM change
 *   GET /api/v1/admin/analytics/signups?days=30   daily signups (zero-filled)
 *   GET /api/v1/admin/analytics/matches?weeks=8    interests sent vs accepted
 *   GET /api/v1/admin/analytics/stay-quotient      engagement-risk distribution
 *   GET /api/v1/admin/analytics/revenue?months=6   subscription revenue by plan
 *   GET /api/v1/admin/analytics/top-matches        top 10 by compatibility
 *
 * Intentional deviations from the original brief (data reality):
 *   - "Avg Compatibility" / top-matches use match_scores.totalScore +
 *     gunaMilanScore. DPI is Redis-only (no Postgres column), so it cannot
 *     be aggregated here. FII band is derived from
 *     profiles.familyInclinationScore.
 *   - Stay Quotient distribution is an engagement-activity proxy off
 *     profiles.lastActiveAt — the true churn score is a Redis-cached,
 *     per-user AI call with no bulk source.
 */
import { Router, type Request, type Response } from 'express';
import { sql, eq, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { authenticate, authorize } from '../auth/middleware.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { ok, err } from '../lib/response.js';
import {
  user,
  profiles,
  matchRequests,
  matchScores,
  payments,
  subscriptions,
  subscriptionCharges,
  plans,
} from '@smartshaadi/db';

export const adminAnalyticsRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

function clampInt(raw: unknown, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function ymd(d: Date): string {
  return startOfUTCDay(d).toISOString().slice(0, 10);
}

function ym(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** ISO-8601 week label, e.g. 2026-W18 — matches Postgres to_char(d,'IYYY"-W"IW'). */
function isoWeekLabel(input: Date): string {
  const d = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = d.getTime();
  const isoYear = d.getUTCFullYear();
  d.setUTCMonth(0, 1);
  if (d.getUTCDay() !== 4) {
    d.setUTCMonth(0, 1 + ((4 - d.getUTCDay() + 7) % 7));
  }
  const week = 1 + Math.round((firstThursday - d.getTime()) / (7 * DAY_MS));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

type Trend = 'up' | 'down' | 'flat';
function delta(curr: number, prev: number): { changePct: number | null; trend: Trend } {
  if (prev === 0) {
    return curr > 0 ? { changePct: 100, trend: 'up' } : { changePct: null, trend: 'flat' };
  }
  const pct = Math.round(((curr - prev) / prev) * 1000) / 10;
  return { changePct: pct, trend: pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat' };
}

const PLAN_KEY: Record<string, 'standard_m' | 'standard_y' | 'premium_m' | 'premium_y'> = {
  STANDARD_M: 'standard_m',
  STANDARD_Y: 'standard_y',
  PREMIUM_M: 'premium_m',
  PREMIUM_Y: 'premium_y',
};

function fiiBand(score: number | null): string {
  if (score == null) return 'N/A';
  if (score >= 80) return 'Very High Family Inclination';
  if (score >= 60) return 'High Family Inclination';
  if (score >= 40) return 'Moderate Family Inclination';
  if (score >= 20) return 'Low Family Inclination';
  return 'Minimal Family Inclination';
}

// ── GET /analytics/overview ───────────────────────────────────────────────────
adminAnalyticsRouter.get(
  '/analytics/overview',
  authenticate,
  authorize(['ADMIN']),
  async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

      const [uRow] = await db
        .select({
          total: sql<string>`count(*) filter (where ${user.deletedAt} is null)`,
          thisM: sql<string>`count(*) filter (where ${user.deletedAt} is null and ${user.createdAt} >= ${monthStart})`,
          prevM: sql<string>`count(*) filter (where ${user.deletedAt} is null and ${user.createdAt} >= ${prevStart} and ${user.createdAt} < ${monthStart})`,
        })
        .from(user);

      const [mRow] = await db
        .select({
          total: sql<string>`count(*) filter (where ${matchRequests.status} = 'ACCEPTED')`,
          thisM: sql<string>`count(*) filter (where ${matchRequests.status} = 'ACCEPTED' and ${matchRequests.respondedAt} >= ${monthStart})`,
          prevM: sql<string>`count(*) filter (where ${matchRequests.status} = 'ACCEPTED' and ${matchRequests.respondedAt} >= ${prevStart} and ${matchRequests.respondedAt} < ${monthStart})`,
        })
        .from(matchRequests);

      const [pRow] = await db
        .select({
          thisM: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} in ('CAPTURED','PARTIALLY_REFUNDED') and ${payments.createdAt} >= ${monthStart}), 0)`,
          prevM: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} in ('CAPTURED','PARTIALLY_REFUNDED') and ${payments.createdAt} >= ${prevStart} and ${payments.createdAt} < ${monthStart}), 0)`,
        })
        .from(payments);

      const [cRow] = await db
        .select({
          all: sql<string>`coalesce(avg(${matchScores.totalScore}), 0)`,
          thisM: sql<string>`coalesce(avg(${matchScores.totalScore}) filter (where ${matchScores.computedAt} >= ${monthStart}), 0)`,
          prevM: sql<string>`coalesce(avg(${matchScores.totalScore}) filter (where ${matchScores.computedAt} >= ${prevStart} and ${matchScores.computedAt} < ${monthStart}), 0)`,
        })
        .from(matchScores);

      const usersTotal = Number(uRow?.total ?? 0);
      const matchesTotal = Number(mRow?.total ?? 0);
      const revenueMtd = Number(pRow?.thisM ?? 0);
      const avgCompat = Math.round(Number(cRow?.all ?? 0) * 10) / 10;

      ok(res, {
        totalUsers: { value: usersTotal, ...delta(Number(uRow?.thisM ?? 0), Number(uRow?.prevM ?? 0)) },
        activeMatches: { value: matchesTotal, ...delta(Number(mRow?.thisM ?? 0), Number(mRow?.prevM ?? 0)) },
        revenueMtd: { value: revenueMtd, ...delta(revenueMtd, Number(pRow?.prevM ?? 0)) },
        avgCompatScore: {
          value: avgCompat,
          ...delta(Number(cRow?.thisM ?? 0), Number(cRow?.prevM ?? 0)),
        },
      });
    } catch (e) {
      logger.error({ err: e }, 'analytics.overview failed');
      err(res, 'ANALYTICS_ERROR', 'Failed to compute overview', 500);
    }
  },
);

// ── GET /analytics/signups?days=30 ────────────────────────────────────────────
adminAnalyticsRouter.get(
  '/analytics/signups',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const days = clampInt(req.query['days'], 30, 7, 90);
      const now = new Date();
      const from = startOfUTCDay(new Date(now.getTime() - (days - 1) * DAY_MS));

      const rows = await db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${user.createdAt}), 'YYYY-MM-DD')`,
          count: sql<string>`count(*)`,
        })
        .from(user)
        .where(sql`${user.deletedAt} is null and ${user.createdAt} >= ${from}`)
        .groupBy(sql`date_trunc('day', ${user.createdAt})`)
        .orderBy(sql`date_trunc('day', ${user.createdAt})`);

      const byDate = new Map<string, number>();
      for (const r of rows as Array<{ date: string; count: string }>) {
        byDate.set(r.date, Number(r.count));
      }

      const data: Array<{ date: string; count: number }> = [];
      for (let t = from.getTime(); t <= now.getTime(); t += DAY_MS) {
        const key = ymd(new Date(t));
        data.push({ date: key, count: byDate.get(key) ?? 0 });
      }

      ok(res, { data }, 200, { days });
    } catch (e) {
      logger.error({ err: e }, 'analytics.signups failed');
      err(res, 'ANALYTICS_ERROR', 'Failed to compute signups', 500);
    }
  },
);

// ── GET /analytics/matches?weeks=8 ────────────────────────────────────────────
adminAnalyticsRouter.get(
  '/analytics/matches',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const weeks = clampInt(req.query['weeks'], 8, 1, 12);
      const now = new Date();
      const from = startOfUTCDay(new Date(now.getTime() - weeks * 7 * DAY_MS));

      const sentRows = await db
        .select({
          week: sql<string>`to_char(${matchRequests.createdAt}, 'IYYY"-W"IW')`,
          n: sql<string>`count(*)`,
        })
        .from(matchRequests)
        .where(sql`${matchRequests.createdAt} >= ${from}`)
        .groupBy(sql`to_char(${matchRequests.createdAt}, 'IYYY"-W"IW')`);

      const acceptedRows = await db
        .select({
          week: sql<string>`to_char(${matchRequests.respondedAt}, 'IYYY"-W"IW')`,
          n: sql<string>`count(*)`,
        })
        .from(matchRequests)
        .where(
          sql`${matchRequests.status} = 'ACCEPTED' and ${matchRequests.respondedAt} is not null and ${matchRequests.respondedAt} >= ${from}`,
        )
        .groupBy(sql`to_char(${matchRequests.respondedAt}, 'IYYY"-W"IW')`);

      const sentMap = new Map<string, number>();
      for (const r of sentRows as Array<{ week: string; n: string }>) sentMap.set(r.week, Number(r.n));
      const accMap = new Map<string, number>();
      for (const r of acceptedRows as Array<{ week: string; n: string }>) accMap.set(r.week, Number(r.n));

      const labels: string[] = [];
      const seen = new Set<string>();
      for (let t = from.getTime(); t <= now.getTime(); t += 7 * DAY_MS) {
        const lbl = isoWeekLabel(new Date(t));
        if (!seen.has(lbl)) {
          seen.add(lbl);
          labels.push(lbl);
        }
      }
      const lastLbl = isoWeekLabel(now);
      if (!seen.has(lastLbl)) labels.push(lastLbl);

      const data = labels.map((week) => ({
        week,
        sent: sentMap.get(week) ?? 0,
        accepted: accMap.get(week) ?? 0,
      }));

      ok(res, { data }, 200, { weeks });
    } catch (e) {
      logger.error({ err: e }, 'analytics.matches failed');
      err(res, 'ANALYTICS_ERROR', 'Failed to compute match activity', 500);
    }
  },
);

// ── GET /analytics/stay-quotient ──────────────────────────────────────────────
// Engagement-risk proxy off profiles.lastActiveAt (true churn score is
// Redis-only AI; not bulk-queryable). Tiers: ENGAGED / LOW / MEDIUM / HIGH.
adminAnalyticsRouter.get(
  '/analytics/stay-quotient',
  authenticate,
  authorize(['ADMIN']),
  async (_req: Request, res: Response) => {
    try {
      const now = Date.now();
      const d3 = new Date(now - 3 * DAY_MS);
      const d7 = new Date(now - 7 * DAY_MS);
      const d21 = new Date(now - 21 * DAY_MS);

      const tierExpr = sql<string>`case
        when ${profiles.lastActiveAt} is null then 'HIGH_RISK'
        when ${profiles.lastActiveAt} >= ${d3} then 'ENGAGED'
        when ${profiles.lastActiveAt} >= ${d7} then 'LOW_RISK'
        when ${profiles.lastActiveAt} >= ${d21} then 'MEDIUM_RISK'
        else 'HIGH_RISK' end`;

      const rows = await db
        .select({ tier: tierExpr, count: sql<string>`count(*)` })
        .from(profiles)
        .where(eq(profiles.isActive, true))
        .groupBy(tierExpr);

      const counts = new Map<string, number>();
      for (const r of rows as Array<{ tier: string; count: string }>) {
        counts.set(r.tier, Number(r.count));
      }
      const data = (['ENGAGED', 'LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK'] as const).map((tier) => ({
        tier,
        count: counts.get(tier) ?? 0,
      }));

      ok(res, { data, basis: 'engagement-activity' });
    } catch (e) {
      logger.error({ err: e }, 'analytics.stay-quotient failed');
      err(res, 'ANALYTICS_ERROR', 'Failed to compute engagement distribution', 500);
    }
  },
);

// ── GET /analytics/revenue?months=6 ───────────────────────────────────────────
adminAnalyticsRouter.get(
  '/analytics/revenue',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const months = clampInt(req.query['months'], 6, 1, 12);
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

      const rows = await db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${subscriptionCharges.createdAt}), 'YYYY-MM')`,
          code: plans.code,
          total: sql<string>`coalesce(sum(${subscriptionCharges.amount}), 0)`,
        })
        .from(subscriptionCharges)
        .innerJoin(subscriptions, eq(subscriptionCharges.subscriptionId, subscriptions.id))
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(sql`${subscriptionCharges.createdAt} >= ${from}`)
        .groupBy(sql`date_trunc('month', ${subscriptionCharges.createdAt})`, plans.code);

      const blank = () => ({ standard_m: 0, standard_y: 0, premium_m: 0, premium_y: 0 });
      const byMonth = new Map<string, ReturnType<typeof blank>>();
      for (const r of rows as Array<{ month: string; code: string; total: string }>) {
        const bucket = byMonth.get(r.month) ?? blank();
        const key = PLAN_KEY[r.code];
        if (key) bucket[key] += Number(r.total);
        byMonth.set(r.month, bucket);
      }

      const data: Array<{ month: string } & ReturnType<typeof blank>> = [];
      for (let i = 0; i < months; i += 1) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1) + i, 1));
        const key = ym(d);
        data.push({ month: key, ...(byMonth.get(key) ?? blank()) });
      }

      ok(res, { data }, 200, { months });
    } catch (e) {
      logger.error({ err: e }, 'analytics.revenue failed');
      err(res, 'ANALYTICS_ERROR', 'Failed to compute revenue', 500);
    }
  },
);

// ── GET /analytics/top-matches ────────────────────────────────────────────────
adminAnalyticsRouter.get(
  '/analytics/top-matches',
  authenticate,
  authorize(['ADMIN']),
  async (_req: Request, res: Response) => {
    try {
      const pA = alias(profiles, 'pa');
      const pB = alias(profiles, 'pb');
      const uA = alias(user, 'ua');
      const uB = alias(user, 'ub');

      const rows = await db
        .select({
          userA: uA.name,
          userB: uB.name,
          totalScore: matchScores.totalScore,
          gunaMilanScore: matchScores.gunaMilanScore,
          fiiScore: pA.familyInclinationScore,
          computedAt: matchScores.computedAt,
        })
        .from(matchScores)
        .innerJoin(pA, eq(matchScores.profileA, pA.id))
        .innerJoin(pB, eq(matchScores.profileB, pB.id))
        .innerJoin(uA, eq(pA.userId, uA.id))
        .innerJoin(uB, eq(pB.userId, uB.id))
        .orderBy(desc(matchScores.totalScore))
        .limit(10);

      const data = (
        rows as Array<{
          userA: string;
          userB: string;
          totalScore: number;
          gunaMilanScore: number | null;
          fiiScore: number | null;
          computedAt: Date;
        }>
      ).map((r) => ({
        userA: r.userA,
        userB: r.userB,
        totalScore: r.totalScore,
        gunaMilanScore: r.gunaMilanScore,
        fiiBand: fiiBand(r.fiiScore),
        computedAt: r.computedAt,
      }));

      ok(res, { data });
    } catch (e) {
      logger.error({ err: e }, 'analytics.top-matches failed');
      err(res, 'ANALYTICS_ERROR', 'Failed to compute top matches', 500);
    }
  },
);
