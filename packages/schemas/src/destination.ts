/**
 * Smart Shaadi — Destination wedding validation schemas
 * packages/schemas/src/destination.ts
 *
 * Phase 8 Sprint I (Unit 8.1). The contract the web Server Actions post against
 * and the API validates with.
 *
 * `CountryCodeSchema` and `IanaTimezoneSchema` are REUSED from './nri.js' — they
 * already uppercase the country code and validate the timezone against the
 * runtime's own zone database. Duplicating them here would let a leg and a
 * profile drift apart on the same concept.
 */

import { z } from 'zod';
import { CountryCodeSchema, IanaTimezoneSchema } from './nri.js';

/** `YYYY-MM-DD`, and a real date — `2026-02-31` parses as a string but is not a day. */
export const CalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, { message: 'Not a real calendar date' });

/** 24-hour `HH:MM`. Matches the varchar(10) convention on ceremonies.start_time. */
export const ClockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24-hour)');

/**
 * The arrive/depart window. Also enforced by the DB CHECK constraint
 * `destinations_date_window_ck` — validating in both places means a direct SQL
 * write cannot produce a leg the UI can't render.
 *
 * Equal dates are VALID: a single-day leg is a real thing (fly in, ceremony,
 * fly out).
 */
// `| undefined` is explicit on both fields: this package compiles with
// `exactOptionalPropertyTypes: true`, under which `arriveOn?: string` and
// `arriveOn?: string | undefined` are different types, and the partial schema
// produces the latter.
const dateWindowRefinement = {
  check: (d: { arriveOn?: string | undefined; departOn?: string | undefined }) =>
    !d.arriveOn || !d.departOn || d.departOn >= d.arriveOn,
  message: 'Departure must be on or after arrival',
  path: ['departOn'] as const,
};

export const CreateDestinationSchema = z
  .object({
    city:         z.string().trim().min(1, 'City is required').max(100),
    countryCode:  CountryCodeSchema.default('IN'),
    ianaTimezone: IanaTimezoneSchema.default('Asia/Kolkata'),
    arriveOn:     CalendarDateSchema,
    departOn:     CalendarDateSchema,
    sortOrder:    z.number().int().min(0).max(9999).default(0),
    isPrimary:    z.boolean().default(false),
    notes:        z.string().trim().max(2000).optional(),
  })
  .refine(dateWindowRefinement.check, {
    message: dateWindowRefinement.message,
    path:    [...dateWindowRefinement.path],
  });

/**
 * Partial update. `.partial()` is applied to the inner object BEFORE the refine,
 * because a refinement on a ZodEffects cannot be made partial — the window check
 * is re-attached here and tolerates a one-sided update by short-circuiting on
 * undefined.
 *
 * Note this means updating only `arriveOn` to a date after the stored `departOn`
 * passes Zod; the DB CHECK constraint is what rejects it. The service surfaces
 * that as INVALID_DATE_RANGE.
 */
export const UpdateDestinationSchema = z
  .object({
    city:         z.string().trim().min(1).max(100),
    countryCode:  CountryCodeSchema,
    ianaTimezone: IanaTimezoneSchema,
    arriveOn:     CalendarDateSchema,
    departOn:     CalendarDateSchema,
    sortOrder:    z.number().int().min(0).max(9999),
    isPrimary:    z.boolean(),
    notes:        z.string().trim().max(2000).nullable(),
  })
  .partial()
  .refine(dateWindowRefinement.check, {
    message: dateWindowRefinement.message,
    path:    [...dateWindowRefinement.path],
  });

/**
 * Upsert of one guest's travel for one leg. Every field is optional because a
 * planner routinely knows the guest is coming long before they know the flight.
 */
export const UpsertGuestTravelLegSchema = z
  .object({
    guestId:       z.string().uuid('guestId must be a UUID'),
    arrivalDate:   CalendarDateSchema.nullable().optional(),
    arrivalTime:   ClockTimeSchema.nullable().optional(),
    departureDate: CalendarDateSchema.nullable().optional(),
    departureTime: ClockTimeSchema.nullable().optional(),
    travelNotes:   z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (d) => !d.arrivalDate || !d.departureDate || d.departureDate >= d.arrivalDate,
    { message: 'Departure must be on or after arrival', path: ['departureDate'] },
  );

/**
 * Reorder. The full set of leg ids for the wedding, in the new order — the
 * service rejects the whole request unless every id belongs to that wedding, so
 * a partial or foreign list cannot half-apply.
 */
export const ReorderDestinationsSchema = z.object({
  order: z
    .array(
      z.object({
        id:        z.string().uuid(),
        sortOrder: z.number().int().min(0).max(9999),
      }),
    )
    .min(1, 'At least one destination is required')
    .max(50, 'Too many destinations'),
});

export type CreateDestinationInput      = z.infer<typeof CreateDestinationSchema>;
export type UpdateDestinationInput      = z.infer<typeof UpdateDestinationSchema>;
export type UpsertGuestTravelLegInput   = z.infer<typeof UpsertGuestTravelLegSchema>;
export type ReorderDestinationsInput    = z.infer<typeof ReorderDestinationsSchema>;
