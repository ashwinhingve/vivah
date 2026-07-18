import { z } from 'zod';

// Mirrors @smartshaadi/types finance-referral.ts (Phase 6 Tier 2/3 shells).

export const SERVICE_REFERRAL_KINDS = ['LENDING', 'INSURANCE'] as const;
export const ServiceReferralKindSchema = z.enum(SERVICE_REFERRAL_KINDS);

export const INSURANCE_SKUS = ['HEALTH', 'LIFE', 'TRAVEL', 'WEDDING'] as const;
export const InsuranceSkuSchema = z.enum(INSURANCE_SKUS);

export const WHATSAPP_TEMPLATES = ['BOOKING_CONFIRMATION', 'BOOKING_REMINDER'] as const;
export const WhatsAppTemplateSchema = z.enum(WHATSAPP_TEMPLATES);

// ── Lending consent (6.2) ─────────────────────────────────────────────────────
// RBI Directions 2025: consent must be explicit and never pre-ticked. The
// `consent` boolean is REQUIRED to be literal true — a missing/false value is a
// validation error, so the server can never record a referral from a blank box.

export const RecordLendingConsentSchema = z.object({
  offerRef:  z.string().min(1).max(120),
  context:   z.string().min(1).max(40).default('BOOKING'),
  contextId: z.string().uuid().nullable().optional(),
  consent:   z.literal(true, {
    errorMap: () => ({ message: 'Explicit consent is required (must not be pre-ticked)' }),
  }),
});
export type RecordLendingConsentInput = z.infer<typeof RecordLendingConsentSchema>;

// ── Insurance consent (6.3) ───────────────────────────────────────────────────

export const RecordInsuranceConsentSchema = z.object({
  quoteRef:  z.string().min(1).max(120),
  sku:       InsuranceSkuSchema,
  context:   z.string().min(1).max(40).default('BOOKING'),
  contextId: z.string().uuid().nullable().optional(),
  consent:   z.literal(true, {
    errorMap: () => ({ message: 'Explicit consent is required (must not be pre-ticked)' }),
  }),
});
export type RecordInsuranceConsentInput = z.infer<typeof RecordInsuranceConsentSchema>;

// ── Placement query (both shells) ─────────────────────────────────────────────

export const ServiceOfferQuerySchema = z.object({
  context:   z.string().max(40).optional(),
  contextId: z.string().uuid().optional(),
});
export type ServiceOfferQuery = z.infer<typeof ServiceOfferQuerySchema>;

// ── WhatsApp send (6.1) ───────────────────────────────────────────────────────
// E.164-ish phone: leading +, 8–15 digits.

export const SendWhatsAppSchema = z.object({
  toPhone:  z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
  template: WhatsAppTemplateSchema,
  params:   z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  contextId: z.string().uuid().nullable().optional(),
});
export type SendWhatsAppInput = z.infer<typeof SendWhatsAppSchema>;
