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

/**
 * GET /api/v1/calendar/heatmap — month aggregated heat-map data
 *
 * Returns per-day aggregation for a given month (YYYY-MM format):
 * - auspiciousBand intensity (NONE→LOW→MEDIUM→HIGH→PEAK)
 * - kinds present on that day
 * - demand metric (deterministic proxy: band rank + kind count, no LLM)
 *
 * Same national-inclusive region/community filtering as /events.
 * Redis cached (6h).
 */
interface HeatmapDay {
  date: string;                           // YYYY-MM-DD
  auspiciousBand: string;                 // highest band on this day
  kinds: Array<{ kind: string; count: number }>;
  demand: number;                         // 0.0 to 1.0, deterministic metric
}

interface HeatmapResponse {
  month: string;                          // YYYY-MM
  days: HeatmapDay[];
  regionFilter?: string;
  communityFilter?: string;
}

calendarRouter.get('/heatmap', authenticate, async (req: Request, res: Response) => {
  const month = typeof req.query.month === 'string' ? req.query.month : '';
  const region = typeof req.query.region === 'string' ? req.query.region : undefined;
  const community = typeof req.query.community === 'string' ? req.query.community : undefined;

  // Validate month format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    err(res, 'VALIDATION_ERROR', 'month must be YYYY-MM format', 400);
    return;
  }

  const cacheKey = `calendar:heatmap:${month}:${region ?? '*'}:${community ?? '*'}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      const result = JSON.parse(cached) as HeatmapResponse;
      ok(res, result, 200, { cached: true });
      return;
    }
  } catch {
    // cache miss / parse failure — fall through to DB
  }

  try {
    // Parse month to get date range
    const parts = month.split('-');
    const yearStr = parts[0];
    const monthStr = parts[1];

    if (!yearStr || !monthStr) {
      err(res, 'VALIDATION_ERROR', 'Invalid month format', 400);
      return;
    }

    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    if (year < 1900 || year > 2100 || monthNum < 1 || monthNum > 12) {
      err(res, 'VALIDATION_ERROR', 'Invalid month', 400);
      return;
    }

    const startDateStr = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
    const endDateStr = new Date(year, monthNum, 0).toISOString().split('T')[0];

    if (!startDateStr || !endDateStr) {
      err(res, 'CALENDAR_ERROR', 'Failed to parse month', 500);
      return;
    }

    const filters: SQL[] = [
      gte(calendarEvents.eventDate, startDateStr),
      lte(calendarEvents.eventDate, endDateStr),
    ];

    if (region) {
      const regionFilter = or(isNull(calendarEvents.region), eq(calendarEvents.region, region));
      if (regionFilter) filters.push(regionFilter);
    }

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

    // Aggregate by date
    const dayMap = new Map<string, { bands: Set<string>; kinds: Map<string, number> }>();

    rows.forEach(row => {
      const eventDate = row.eventDate;
      // Handle date ranges: expand endDate if present
      const end = row.endDate ? new Date(row.endDate) : new Date(eventDate);
      const start = new Date(eventDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr) {
          if (!dayMap.has(dateStr)) {
            dayMap.set(dateStr, { bands: new Set(), kinds: new Map() });
          }
          const entry = dayMap.get(dateStr)!;
          entry.bands.add(row.auspiciousBand);
          entry.kinds.set(row.kind, (entry.kinds.get(row.kind) ?? 0) + 1);
        }
      }
    });

    // Band ranking for demand calculation
    const bandRank: Record<string, number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      PEAK: 4,
    };

    // Build result
    const days: HeatmapDay[] = [];

    for (let d = new Date(year, monthNum - 1, 1); d.getMonth() === monthNum - 1; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!dateStr) continue;

      const entry = dayMap.get(dateStr);

      if (entry && entry.bands.size > 0) {
        // Find highest band
        const bands = Array.from(entry.bands);
        const highestBand = bands.sort((a, b) => (bandRank[b] ?? 0) - (bandRank[a] ?? 0))[0] ?? 'NONE';

        // Calculate demand: (band rank / 4) * 0.6 + (kind count / 6) * 0.4
        const bandContribution = (bandRank[highestBand] ?? 0) / 4 * 0.6;
        const kindContribution = (entry.kinds.size / 6) * 0.4; // 6 possible kinds
        const demand = Math.min(bandContribution + kindContribution, 1.0);

        const kinds = Array.from(entry.kinds.entries())
          .map(([k, count]) => ({ kind: k, count }))
          .sort((a, b) => b.count - a.count);

        days.push({
          date: dateStr,
          auspiciousBand: highestBand,
          kinds,
          demand,
        });
      }
    }

    const result: HeatmapResponse = {
      month,
      days,
      ...(region && { regionFilter: region }),
      ...(community && { communityFilter: community }),
    };

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch {
      // non-fatal: serve uncached
    }

    ok(res, result, 200, { cached: false });
  } catch (e) {
    console.error('[calendar] heatmap query failed:', e);
    err(res, 'CALENDAR_ERROR', 'Failed to load heatmap data', 500);
  }
});
