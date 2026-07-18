/**
 * Smart Shaadi — NRI / international matching validation schemas
 * packages/schemas/src/nri.ts
 *
 * Phase 7 Sprint G (Unit 7.2). Frozen in Phase 0 — this is the contract Track D
 * (web UI) posts against and Track A (matchmaking) filters on, so neither track
 * needs to edit the other's files.
 */

import { z } from 'zod';

export const ResidencyStatusSchema = z.enum([
  'CITIZEN', 'PERM_RESIDENT', 'WORK_VISA', 'STUDENT_VISA', 'DEPENDENT_VISA', 'OTHER',
]);

export const SupportedCurrencySchema = z.enum([
  'INR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD', 'SGD',
]);

/**
 * ISO 3166-1 alpha-2. Uppercased on the way in so 'in' and 'IN' don't produce two
 * different countries — the cross-border check is a string comparison, and a
 * case mismatch would silently make a domestic pair look international.
 */
export const CountryCodeSchema = z
  .string()
  .trim()
  .length(2, 'Country must be an ISO 3166-1 alpha-2 code')
  .regex(/^[A-Za-z]{2}$/, 'Country must be two letters')
  .transform((v) => v.toUpperCase());

/**
 * IANA timezone identifier, validated against the runtime's own zone database
 * rather than a hardcoded list — Node 22 ships full ICU (~420 zones), so this
 * accepts exactly the zones Intl.DateTimeFormat can actually format.
 */
export const IanaTimezoneSchema = z
  .string()
  .trim()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, { message: 'Must be a valid IANA timezone, e.g. Asia/Kolkata' });

/** Descriptive detail persisted to Mongo ProfileContent.nri — no documents/numbers. */
export const NriSectionSchema = z.object({
  visaDetails:        z.string().max(200).optional(),
  relocationTimeline: z.string().max(200).optional(),
  yearsAbroad:        z.number().int().min(0).max(80).optional(),
});

/** PATCH payload for the NRI profile fields. Every field optional — partial update. */
export const UpdateNriProfileSchema = z.object({
  countryOfResidence: CountryCodeSchema.optional(),
  citizenship:        CountryCodeSchema.nullable().optional(),
  residencyStatus:    ResidencyStatusSchema.nullable().optional(),
  willingToRelocate:  z.boolean().optional(),
  openToNriMatching:  z.boolean().optional(),
  ianaTimezone:       IanaTimezoneSchema.nullable().optional(),
  displayCurrency:    SupportedCurrencySchema.optional(),
  nri:                NriSectionSchema.optional(),
}).refine(
  (o) => Object.keys(o).length > 0,
  { message: 'At least one field must be provided' },
);

/** Query params for the NRI discovery facets. */
export const NriSearchFiltersSchema = z.object({
  nriOnly:           z.coerce.boolean().optional(),
  countries:         z.array(CountryCodeSchema).max(20).optional(),
  residencyStatuses: z.array(ResidencyStatusSchema).max(6).optional(),
  willingToRelocate: z.coerce.boolean().optional(),
});

export type UpdateNriProfileInput = z.infer<typeof UpdateNriProfileSchema>;
export type NriSearchFiltersInput = z.infer<typeof NriSearchFiltersSchema>;
export type NriSectionInput       = z.infer<typeof NriSectionSchema>;
