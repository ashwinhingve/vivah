import { z } from 'zod';
import { MoneySchema } from './money.js';

// Mirrors @smartshaadi/types pricing.ts (Dynamic Pricing v1).
// See docs/adr/ADR-001-pricing-model.md for the deterministic formula.
// profileId is a raw UUID here; ProfileId brand applied at the resolver boundary.

const profileId = z.string().uuid();

export const PRICING_FACTORS = ['MUHURAT', 'OFFSEASON', 'DEMAND'] as const;
export const PricingFactorSchema = z.enum(PRICING_FACTORS);

export const PRICING_RULE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const PricingRuleStatusSchema = z.enum(PRICING_RULE_STATUSES);

export const CreatePricingRuleSchema = z.object({
  profileId,
  serviceCategory:     z.string().min(1).max(100),
  base:                MoneySchema,
  floorMultiplier:     z.number().positive().max(10),
  ceilingMultiplier:   z.number().positive().max(10),
  muhuratMultiplier:   z.number().positive().max(10).default(1),
  offSeasonMultiplier: z.number().positive().max(10).default(1),
  demandMultiplier:    z.number().positive().max(10).default(1),
  status:              PricingRuleStatusSchema.default('ACTIVE'),
}).refine((v) => v.ceilingMultiplier >= v.floorMultiplier, {
  message: 'ceilingMultiplier must be >= floorMultiplier',
  path:    ['ceilingMultiplier'],
});

export const UpdatePricingRuleSchema = z.object({
  base:                MoneySchema.optional(),
  floorMultiplier:     z.number().positive().max(10).optional(),
  ceilingMultiplier:   z.number().positive().max(10).optional(),
  muhuratMultiplier:   z.number().positive().max(10).optional(),
  offSeasonMultiplier: z.number().positive().max(10).optional(),
  demandMultiplier:    z.number().positive().max(10).optional(),
  status:              PricingRuleStatusSchema.optional(),
});

export type CreatePricingRuleInput = z.infer<typeof CreatePricingRuleSchema>;
export type UpdatePricingRuleInput = z.infer<typeof UpdatePricingRuleSchema>;
