/**
 * Smart Shaadi — Premium package supply + post-marriage service schemas
 * packages/schemas/src/supply.ts
 *
 * Phase 8, Units 8.1 (supply half) and 8.2. The contract the web Server Actions
 * post against and the API validates with.
 *
 * `CalendarDateSchema` is REUSED from './destination.js' — it already rejects
 * `2026-02-31`, which a bare regex accepts. `CountryCodeSchema` comes from
 * './nri.js' for the same reason the destination schemas take it from there: a
 * package's country and a profile's country must not drift apart.
 *
 * MONEY is validated as a decimal STRING in rupees, not a number. pg `numeric`
 * exceeds float64's exact range, and `JSON.parse` on a large amount silently
 * loses precision — so the amount stays a string end to end and is parsed only
 * at the render boundary.
 *
 * NOTE: these packages compile with `exactOptionalPropertyTypes: true`, so
 * optional fields that may be explicitly undefined are typed `T | undefined`.
 */

import { z } from 'zod';
import { CalendarDateSchema } from './destination.js';
import { CountryCodeSchema } from './nri.js';

// ── Shared ───────────────────────────────────────────────────────────────────

/**
 * A decimal amount in rupees, as a string: up to 10 integer digits and at most
 * 2 decimal places, matching numeric(12,2). Rejects negatives — every price
 * column in 0037 carries a `>= 0` CHECK, and failing here gives a field-level
 * message instead of a 500 from the constraint.
 */
export const RupeeAmountSchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Amount must be a positive rupee value, e.g. 450000.00');

/**
 * URL-safe slug. Lowercase so the unique index cannot be defeated by casing —
 * Postgres unique indexes are case-SENSITIVE, so 'goa-luxe' and 'Goa-Luxe'
 * would both be accepted and then render as two different pages.
 */
export const SlugSchema = z
  .string()
  .min(3)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with single hyphens');

export const PremiumPackageTierSchema = z.enum(['ESSENTIAL', 'SIGNATURE', 'LUXE']);
export const PackageInclusionKindSchema = z.enum(['INCLUSION', 'EXCLUSION']);
export const ServicePriceUnitSchema = z.enum([
  'FIXED', 'PER_HOUR', 'PER_MONTH', 'PER_PERSON', 'QUOTE',
]);
export const ServiceEnquiryStatusSchema = z.enum(['OPEN', 'CONTACTED', 'CLOSED']);

// ── 8.1 Premium packages — browse ────────────────────────────────────────────

/**
 * Browse filters. Every field is optional: the bare /packages route must return
 * the full catalogue rather than 400.
 *
 * `capacity` is a single number — "I have 250 guests" — matched against the
 * package's min/max range, which is the question a user actually asks. Exposing
 * two capacity inputs would let them describe a range no package can satisfy.
 */
export const PremiumPackageListQuerySchema = z.object({
  q:        z.string().min(1).max(120).optional(),
  city:     z.string().min(1).max(100).optional(),
  tier:     PremiumPackageTierSchema.optional(),
  capacity: z.coerce.number().int().min(1).max(100000).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  sort:     z.enum(['PRICE_ASC', 'PRICE_DESC', 'CAPACITY_DESC', 'DEFAULT']).default('DEFAULT'),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(48).default(12),
}).refine(
  (d) => d.priceMin === undefined || d.priceMax === undefined || d.priceMax >= d.priceMin,
  { message: 'priceMax must be greater than or equal to priceMin', path: ['priceMax'] },
);

// ── 8.1 Premium packages — admin CRUD ────────────────────────────────────────

const InclusionInputSchema = z.object({
  kind:      PackageInclusionKindSchema.default('INCLUSION'),
  label:     z.string().min(1).max(300),
  sortOrder: z.number().int().min(0).default(0),
});

const AvailabilityInputSchema = z.object({
  blockedFrom: CalendarDateSchema,
  blockedTo:   CalendarDateSchema,
  reason:      z.string().max(255).optional(),
}).refine((d) => d.blockedTo >= d.blockedFrom, {
  message: 'blockedTo must be on or after blockedFrom',
  path:    ['blockedTo'],
});

/**
 * Mirrors the three CHECK constraints in 0037 so a bad admin edit fails with a
 * field-level message instead of a constraint violation surfacing as a 500.
 * The DB keeps its checks regardless — a direct SQL write must not be able to
 * create a row the UI cannot render.
 */
export const CreatePremiumPackageSchema = z.object({
  vendorId:        z.string().uuid(),
  slug:            SlugSchema,
  title:           z.string().min(3).max(200),
  tier:            PremiumPackageTierSchema.default('SIGNATURE'),
  destinationCity: z.string().min(2).max(100),
  countryCode:     CountryCodeSchema.default('IN'),
  priceFrom:       RupeeAmountSchema,
  currency:        z.string().length(3).default('INR'),
  guestCapacityMin: z.number().int().min(0).default(0),
  guestCapacityMax: z.number().int().min(1),
  durationNights:   z.number().int().min(0).default(1),
  summary:      z.string().max(300).optional(),
  description:  z.string().max(20000).optional(),
  heroImageUrl: z.string().max(500).optional(),
  isPlaceholder: z.boolean().default(false),
  isActive:      z.boolean().default(true),
  sortOrder:     z.number().int().min(0).default(0),
  inclusions:   z.array(InclusionInputSchema).max(60).optional(),
  availability: z.array(AvailabilityInputSchema).max(60).optional(),
}).refine((d) => d.guestCapacityMax >= d.guestCapacityMin, {
  message: 'guestCapacityMax must be greater than or equal to guestCapacityMin',
  path:    ['guestCapacityMax'],
});

/**
 * Partial update. Declared as its own object rather than `.partial()` on the
 * create schema, because a ZodEffects (the result of `.refine`) has no
 * `.partial()`. The capacity cross-check is re-applied for the case where both
 * bounds are supplied together.
 */
export const UpdatePremiumPackageSchema = z.object({
  slug:            SlugSchema.optional(),
  title:           z.string().min(3).max(200).optional(),
  tier:            PremiumPackageTierSchema.optional(),
  destinationCity: z.string().min(2).max(100).optional(),
  countryCode:     CountryCodeSchema.optional(),
  priceFrom:       RupeeAmountSchema.optional(),
  currency:        z.string().length(3).optional(),
  guestCapacityMin: z.number().int().min(0).optional(),
  guestCapacityMax: z.number().int().min(1).optional(),
  durationNights:   z.number().int().min(0).optional(),
  summary:      z.string().max(300).nullable().optional(),
  description:  z.string().max(20000).nullable().optional(),
  heroImageUrl: z.string().max(500).nullable().optional(),
  isPlaceholder: z.boolean().optional(),
  isActive:      z.boolean().optional(),
  sortOrder:     z.number().int().min(0).optional(),
  inclusions:   z.array(InclusionInputSchema).max(60).optional(),
  availability: z.array(AvailabilityInputSchema).max(60).optional(),
}).refine(
  (d) => d.guestCapacityMin === undefined
      || d.guestCapacityMax === undefined
      || d.guestCapacityMax >= d.guestCapacityMin,
  { message: 'guestCapacityMax must be greater than or equal to guestCapacityMin', path: ['guestCapacityMax'] },
);

/**
 * A package enquiry. Deliberately thin: it reuses `vendor_inquiries`, whose
 * other fields (ceremonyType, budget) are optional there too, so a package
 * enquiry does not have to pretend to be a full vendor brief.
 */
export const CreatePackageEnquirySchema = z.object({
  message:    z.string().min(10).max(2000),
  eventDate:  CalendarDateSchema.optional(),
  guestCount: z.number().int().min(1).max(100000).optional(),
  budgetMin:  RupeeAmountSchema.optional(),
  budgetMax:  RupeeAmountSchema.optional(),
}).refine(
  (d) => d.budgetMin === undefined || d.budgetMax === undefined
      || Number(d.budgetMax) >= Number(d.budgetMin),
  { message: 'budgetMax must be greater than or equal to budgetMin', path: ['budgetMax'] },
);

// ── 8.2 Post-marriage services ───────────────────────────────────────────────

export const PostMarriageServiceListQuerySchema = z.object({
  q:        z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(80).optional(),
  city:     z.string().min(1).max(100).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  sort:     z.enum(['PRICE_ASC', 'PRICE_DESC', 'DEFAULT']).default('DEFAULT'),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(48).default(12),
}).refine(
  (d) => d.priceMin === undefined || d.priceMax === undefined || d.priceMax >= d.priceMin,
  { message: 'priceMax must be greater than or equal to priceMin', path: ['priceMax'] },
);

export const CreatePostMarriageCategorySchema = z.object({
  slug:        SlugSchema.max(80),
  name:        z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  icon:        z.string().max(60).optional(),
  sortOrder:   z.number().int().min(0).default(0),
  isActive:    z.boolean().default(true),
});

export const UpdatePostMarriageCategorySchema = CreatePostMarriageCategorySchema.partial();

export const CreateServicePartnerSchema = z.object({
  categoryId:  z.string().uuid(),
  name:        z.string().min(2).max(200),
  slug:        SlugSchema,
  city:        z.string().max(100).optional(),
  state:       z.string().max(100).optional(),
  countryCode: CountryCodeSchema.default('IN'),
  description:  z.string().max(20000).optional(),
  contactEmail: z.string().email().max(255).optional(),
  contactPhone: z.string().max(20).optional(),
  websiteUrl:   z.string().url().max(500).optional(),
  logoUrl:      z.string().max(500).optional(),
  // Bounded 0-5 to match the service_partners_rating_ck constraint.
  rating:        z.number().min(0).max(5).default(0),
  isPlaceholder: z.boolean().default(false),
  isActive:      z.boolean().default(true),
});

export const UpdateServicePartnerSchema = CreateServicePartnerSchema.partial();

export const CreatePostMarriageServiceSchema = z.object({
  partnerId:   z.string().uuid(),
  categoryId:  z.string().uuid(),
  title:       z.string().min(3).max(200),
  slug:        SlugSchema,
  description: z.string().max(20000).optional(),
  priceFrom:   RupeeAmountSchema.optional(),
  priceTo:     RupeeAmountSchema.optional(),
  priceUnit:   ServicePriceUnitSchema.default('FIXED'),
  currency:    z.string().length(3).default('INR'),
  isPlaceholder: z.boolean().default(false),
  isActive:      z.boolean().default(true),
  sortOrder:     z.number().int().min(0).default(0),
}).refine(
  // Mirrors post_marriage_services_price_ck: only constrains when BOTH bounds
  // are present, so an open-ended "from Rs. 5000" stays legal.
  (d) => d.priceFrom === undefined || d.priceTo === undefined
      || Number(d.priceTo) >= Number(d.priceFrom),
  { message: 'priceTo must be greater than or equal to priceFrom', path: ['priceTo'] },
);

export const UpdatePostMarriageServiceSchema = z.object({
  partnerId:   z.string().uuid().optional(),
  categoryId:  z.string().uuid().optional(),
  title:       z.string().min(3).max(200).optional(),
  slug:        SlugSchema.optional(),
  description: z.string().max(20000).nullable().optional(),
  priceFrom:   RupeeAmountSchema.nullable().optional(),
  priceTo:     RupeeAmountSchema.nullable().optional(),
  priceUnit:   ServicePriceUnitSchema.optional(),
  currency:    z.string().length(3).optional(),
  isPlaceholder: z.boolean().optional(),
  isActive:      z.boolean().optional(),
  sortOrder:     z.number().int().min(0).optional(),
});

export const CreateServiceEnquirySchema = z.object({
  message:          z.string().min(10).max(2000),
  preferredContact: z.enum(['EMAIL', 'PHONE', 'WHATSAPP']).optional(),
  city:             z.string().max(100).optional(),
});

/** Admin reply from the triage queue. Partners have no user account yet. */
export const ReplyServiceEnquirySchema = z.object({
  partnerReply: z.string().min(1).max(4000),
  status:       ServiceEnquiryStatusSchema.default('CONTACTED'),
});

// ── Inferred input types ─────────────────────────────────────────────────────

export type PremiumPackageListQuery      = z.infer<typeof PremiumPackageListQuerySchema>;
export type CreatePremiumPackageInput    = z.infer<typeof CreatePremiumPackageSchema>;
export type UpdatePremiumPackageInput    = z.infer<typeof UpdatePremiumPackageSchema>;
export type CreatePackageEnquiryInput    = z.infer<typeof CreatePackageEnquirySchema>;

export type PostMarriageServiceListQuery    = z.infer<typeof PostMarriageServiceListQuerySchema>;
export type CreatePostMarriageCategoryInput = z.infer<typeof CreatePostMarriageCategorySchema>;
export type UpdatePostMarriageCategoryInput = z.infer<typeof UpdatePostMarriageCategorySchema>;
export type CreateServicePartnerInput       = z.infer<typeof CreateServicePartnerSchema>;
export type UpdateServicePartnerInput       = z.infer<typeof UpdateServicePartnerSchema>;
export type CreatePostMarriageServiceInput  = z.infer<typeof CreatePostMarriageServiceSchema>;
export type UpdatePostMarriageServiceInput  = z.infer<typeof UpdatePostMarriageServiceSchema>;
export type CreateServiceEnquiryInput       = z.infer<typeof CreateServiceEnquirySchema>;
export type ReplyServiceEnquiryInput        = z.infer<typeof ReplyServiceEnquirySchema>;
