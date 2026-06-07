import { z } from 'zod';

// Mirrors @smartshaadi/types calendar.ts (Calendar Intelligence).

export const CALENDAR_EVENT_KINDS = ['MUHURAT', 'FESTIVAL', 'SCHOOL', 'GOVT', 'REGIONAL', 'BLACKOUT'] as const;
export const CalendarEventKindSchema = z.enum(CALENDAR_EVENT_KINDS);

export const AUSPICIOUS_BANDS = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'PEAK'] as const;
export const AuspiciousBandSchema = z.enum(AUSPICIOUS_BANDS);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CreateCalendarEventSchema = z.object({
  kind:           CalendarEventKindSchema,
  name:           z.string().min(1).max(255),
  eventDate:      z.string().regex(ISO_DATE),
  endDate:        z.string().regex(ISO_DATE).nullable().optional(),
  region:         z.string().max(100).nullable().optional(),
  source:         z.string().min(1).max(100),
  auspiciousBand: AuspiciousBandSchema.default('NONE'),
  metadata:       z.record(z.string(), z.unknown()).nullable().optional(),
});

export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventSchema>;

// ── Read / response contracts ─────────────────────────────────────────────────

/** Full calendar_events row as returned by the API. */
export const CalendarEventSchema = z.object({
  id:             z.string().uuid(),
  kind:           CalendarEventKindSchema,
  name:           z.string().min(1).max(255),
  eventDate:      z.string().regex(ISO_DATE),
  endDate:        z.string().regex(ISO_DATE).nullable(),
  region:         z.string().max(100).nullable(),
  source:         z.string().min(1).max(100),
  auspiciousBand: AuspiciousBandSchema,
  metadata:       z.record(z.string(), z.unknown()).nullable(),
  createdAt:      z.string(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

/**
 * Query params for GET /api/v1/calendar/events (range + kind/region/community).
 *
 * `region` and `community` are NATIONAL-INCLUSIVE: passing region='Tamil Nadu'
 * returns national rows (region null) PLUS Tamil Nadu rows — so a regional user
 * sees both Diwali and Pongal, never one at the expense of the other. `community`
 * filters the same way against metadata.community (e.g. 'Jain').
 */
export const CalendarEventsQuerySchema = z.object({
  from:      z.string().regex(ISO_DATE).optional(),
  to:        z.string().regex(ISO_DATE).optional(),
  kind:      CalendarEventKindSchema.optional(),
  region:    z.string().max(100).optional(),
  community: z.string().max(100).optional(),
});

export type CalendarEventsQuery = z.infer<typeof CalendarEventsQuerySchema>;
