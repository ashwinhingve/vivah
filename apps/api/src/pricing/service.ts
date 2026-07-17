/**
 * Dynamic Pricing v1 — service (CRUD + suggestion orchestration)
 *
 * Owns pricing_rules persistence and the suggest() flow. All queries are scoped
 * by profileId (CLAUDE.md rule 2); the caller resolves userId → profileId first
 * (rule 12). Money is stored as bigint paise (pricing_rules.base_paise); the
 * PricingRule type carries a Money { paise, currency }.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { pricingRules } from '@smartshaadi/db';
import { asProfileId, type PricingRule, type ProfileId } from '@smartshaadi/types';
import type { CreatePricingRuleInput, UpdatePricingRuleInput } from '@smartshaadi/schemas';
import { computeSuggestion } from './advisor.service.js';
import { resolveFactors } from './factors.service.js';
import type { PricingSuggestion } from '@smartshaadi/types';

export class PricingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

type PricingRuleRow = typeof pricingRules.$inferSelect;

function rowToPricingRule(row: PricingRuleRow): PricingRule {
  return {
    id: row.id,
    profileId: asProfileId(row.profileId),
    serviceCategory: row.serviceCategory,
    base: { paise: row.basePaise, currency: row.currency },
    floorMultiplier: row.floorMultiplier,
    ceilingMultiplier: row.ceilingMultiplier,
    muhuratMultiplier: row.muhuratMultiplier,
    offSeasonMultiplier: row.offSeasonMultiplier,
    demandMultiplier: row.demandMultiplier,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Create a pricing rule for the authenticated vendor. Scoped by profileId. */
export async function createPricingRule(
  profileId: ProfileId,
  input: CreatePricingRuleInput,
): Promise<PricingRule> {
  if (input.profileId !== profileId) {
    throw new PricingError('FORBIDDEN', 'Profile ID mismatch');
  }

  const [created] = await db
    .insert(pricingRules)
    .values({
      profileId,
      serviceCategory: input.serviceCategory,
      basePaise: input.base.paise,
      currency: input.base.currency,
      floorMultiplier: input.floorMultiplier,
      ceilingMultiplier: input.ceilingMultiplier,
      muhuratMultiplier: input.muhuratMultiplier,
      offSeasonMultiplier: input.offSeasonMultiplier,
      demandMultiplier: input.demandMultiplier,
      status: input.status,
    })
    .returning();

  if (!created) throw new PricingError('INTERNAL_ERROR', 'Failed to create pricing rule');
  return rowToPricingRule(created);
}

/** List the vendor's pricing rules, newest first. Scoped by profileId. */
export async function listPricingRules(profileId: ProfileId): Promise<PricingRule[]> {
  const rows = await db
    .select()
    .from(pricingRules)
    .where(eq(pricingRules.profileId, profileId))
    .orderBy(desc(pricingRules.createdAt));
  return rows.map(rowToPricingRule);
}

/** Fetch a single rule by id, ownership-checked. Returns null if not owned/found. */
export async function getPricingRule(
  profileId: ProfileId,
  ruleId: string,
): Promise<PricingRule | null> {
  const [row] = await db
    .select()
    .from(pricingRules)
    .where(and(eq(pricingRules.id, ruleId), eq(pricingRules.profileId, profileId)))
    .limit(1);
  return row ? rowToPricingRule(row) : null;
}

/**
 * Update a pricing rule. The vendor can always change any bound or multiplier —
 * the suggestion is only advice (ADR constraint 3). Scoped by profileId.
 */
export async function updatePricingRule(
  profileId: ProfileId,
  ruleId: string,
  input: UpdatePricingRuleInput,
): Promise<PricingRule> {
  const existing = await getPricingRule(profileId, ruleId);
  if (!existing) throw new PricingError('NOT_FOUND', 'Pricing rule not found');

  const values: Partial<PricingRuleRow> = { updatedAt: new Date() };
  if (input.base !== undefined) {
    values.basePaise = input.base.paise;
    values.currency = input.base.currency;
  }
  if (input.floorMultiplier !== undefined) values.floorMultiplier = input.floorMultiplier;
  if (input.ceilingMultiplier !== undefined) values.ceilingMultiplier = input.ceilingMultiplier;
  if (input.muhuratMultiplier !== undefined) values.muhuratMultiplier = input.muhuratMultiplier;
  if (input.offSeasonMultiplier !== undefined) values.offSeasonMultiplier = input.offSeasonMultiplier;
  if (input.demandMultiplier !== undefined) values.demandMultiplier = input.demandMultiplier;
  if (input.status !== undefined) values.status = input.status;

  const [updated] = await db
    .update(pricingRules)
    .set(values)
    .where(and(eq(pricingRules.id, ruleId), eq(pricingRules.profileId, profileId)))
    .returning();

  if (!updated) throw new PricingError('INTERNAL_ERROR', 'Failed to update pricing rule');
  return rowToPricingRule(updated);
}

/**
 * Compute a deterministic price suggestion for a rule on a given date.
 * Loads the rule (ownership-checked), resolves live factors, then runs the
 * pure advisor. vendorId keys the vendor's own booking-density demand signal.
 */
export async function suggestPrice(params: {
  profileId: ProfileId;
  vendorId: string;
  ruleId: string;
  date: string;
  region?: string | null;
}): Promise<PricingSuggestion> {
  const { profileId, vendorId, ruleId, date, region } = params;
  const rule = await getPricingRule(profileId, ruleId);
  if (!rule) throw new PricingError('NOT_FOUND', 'Pricing rule not found');

  const { factors, labels } = await resolveFactors({ rule, vendorId, date, region: region ?? null });
  return computeSuggestion(rule, factors, labels);
}
