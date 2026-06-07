/**
 * Smart Shaadi — Calendar Intelligence Router (Phase 5 Tier 1)
 *
 * GET /api/v1/calendar/events — deterministic muhurat / festival / holiday
 *   overlay rows from `calendar_events`, filtered by date range + kind + region.
 *
 * Pure data read: no LLM call (Rule-1 boundary, like Guna Milan). Reference data
 * is global (not tenant-scoped) so Rule-2 userId filtering does not apply.
 * Redis cache-aside (6h) per the matchmaking-engine pattern.
 */
import { Router, type Request, type Response } from 'express';
import { and, asc, eq, gte, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { calendarEvents } from '@smartshaadi/db';
import { CalendarEventsQuerySchema, type CalendarEvent } from '@smartshaadi/schemas';

export const calendarRouter: Router = Router();

const CACHE_TTL = 6 * 60 * 60; // 6h — deterministic reference data, rarely changes

type CalendarRow = typeof calendarEvents.$inferSelect;

function serialize(row: CalendarRow): CalendarEvent {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    eventDate: row.eventDate,
    endDate: row.endDate,
    region: row.region,
    source: row.source,
    auspiciousBand: row.auspiciousBand,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

calendarRouter.get('/events', authenticate, async (req: Request, res: Response) => {
  const parsed = CalendarEventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  const { from, to, kind, region, community } = parsed.data;

  const cacheKey = `calendar:events:${from ?? '*'}:${to ?? '*'}:${kind ?? '*'}:${region ?? '*'}:${community ?? '*'}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      const events = JSON.parse(cached) as CalendarEvent[];
      ok(res, { events, count: events.length }, 200, { cached: true });
      return;
    }
  } catch {
    // cache miss / parse failure — fall through to DB
  }

  try {
    const filters: SQL[] = [];
    if (from) filters.push(gte(calendarEvents.eventDate, from));
    if (to) filters.push(lte(calendarEvents.eventDate, to));
    if (kind) filters.push(eq(calendarEvents.kind, kind));
    // National-inclusive: a regional user sees their region's rows AND national
    // (region null) rows — never one at the expense of the other.
    if (region) {
      const regionFilter = or(isNull(calendarEvents.region), eq(calendarEvents.region, region));
      if (regionFilter) filters.push(regionFilter);
    }
    // community lives in the jsonb metadata blob; same national-inclusive rule
    // (rows with no community tag stay visible).
    if (community) {
      const communityExpr = sql`${calendarEvents.metadata} ->> 'community'`;
      const communityFilter = or(sql`${communityExpr} IS NULL`, sql`${communityExpr} = ${community}`);
      if (communityFilter) filters.push(communityFilter);
    }

    const rows = await db
      .select()
      .from(calendarEvents)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(calendarEvents.eventDate));

    const events = rows.map(serialize);

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(events));
    } catch {
      // non-fatal: serve uncached
    }

    ok(res, { events, count: events.length }, 200, { cached: false });
  } catch (e) {
    console.error('[calendar] events query failed:', e);
    err(res, 'CALENDAR_ERROR', 'Failed to load calendar events', 500);
  }
});
