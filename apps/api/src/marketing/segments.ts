/**
 * Smart Shaadi — Marketing Segments (Unit 6.4, Sprint J)
 *
 * Lazy evaluation of segment predicates. Each function returns the set of
 * Better Auth user IDs matching the segment criteria.
 */

import { and, gt, lt, eq, notExists, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles, matchRequests, vendors, bookings } from '@smartshaadi/db';
import type { MarketingSegmentKey } from '@smartshaadi/types';

/**
 * new_incomplete_48h: profiles joined to user — profile.createdAt > now-48h
 * AND profileCompleteness < 40
 */
async function newIncomplete48h(): Promise<string[]> {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const rows = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(
      and(
        gt(profiles.createdAt, fortyEightHoursAgo),
        lt(profiles.profileCompleteness, 40),
      ),
    );

  return rows.map((r) => r.userId);
}

/**
 * inactive_14d: profiles.lastActiveAt < now-14d AND profiles.createdAt < now-30d
 * AND isActive = true
 */
async function inactive14d(): Promise<string[]> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(
      and(
        lt(profiles.lastActiveAt, fourteenDaysAgo),
        lt(profiles.createdAt, thirtyDaysAgo),
        eq(profiles.isActive, true),
      ),
    );

  return rows.map((r) => r.userId);
}

/**
 * high_intent_7d: distinct senders of matchRequests with createdAt > now-7d
 * (join matchRequests.senderId = profiles.id → profiles.userId)
 */
async function highIntent7d(): Promise<string[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db
    .selectDistinct({ userId: profiles.userId })
    .from(matchRequests)
    .innerJoin(profiles, eq(profiles.id, matchRequests.senderId))
    .where(gt(matchRequests.createdAt, sevenDaysAgo));

  return rows.map((r) => r.userId);
}

/**
 * vendors_new_7d: APPROVED + active vendors created in the last 7 days
 * (onboarding-series audience).
 */
async function vendorsNew7d(): Promise<string[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(
      and(
        eq(vendors.status, 'APPROVED'),
        eq(vendors.isActive, true),
        gt(vendors.createdAt, sevenDaysAgo),
      ),
    );

  return rows.map((r) => r.userId);
}

/**
 * vendors_idle_30d: established (>90d old) APPROVED + active vendors with no
 * booking created in the last 30 days — the re-engagement audience.
 */
async function vendorsIdle30d(): Promise<string[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(
      and(
        eq(vendors.status, 'APPROVED'),
        eq(vendors.isActive, true),
        lt(vendors.createdAt, ninetyDaysAgo),
        notExists(
          db
            .select({ one: sql`1` })
            .from(bookings)
            .where(
              and(
                eq(bookings.vendorId, vendors.id),
                gt(bookings.createdAt, thirtyDaysAgo),
              ),
            ),
        ),
      ),
    );

  return rows.map((r) => r.userId);
}

/**
 * Evaluate a segment by key and return the set of matching user IDs.
 * Exported for testing and admin reporting.
 */
export async function evaluateSegment(segmentKey: MarketingSegmentKey): Promise<string[]> {
  switch (segmentKey) {
    case 'new_incomplete_48h':
      return newIncomplete48h();
    case 'inactive_14d':
      return inactive14d();
    case 'high_intent_7d':
      return highIntent7d();
    case 'vendors_new_7d':
      return vendorsNew7d();
    case 'vendors_idle_30d':
      return vendorsIdle30d();
    default: {
      const _exhaustive: never = segmentKey;
      throw new Error(`Unknown segment: ${String(_exhaustive)}`);
    }
  }
}
