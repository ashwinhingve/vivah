/**
 * Smart Shaadi — Dynamic Pricing v1 Router (Phase 5 Sprint B, Unit 5.4)
 *
 *   POST  /api/v1/pricing/rules      create a pricing rule (vendor)
 *   GET   /api/v1/pricing/rules      list the vendor's rules
 *   PATCH /api/v1/pricing/rules/:id  update a rule (always overridable)
 *   GET   /api/v1/pricing/suggest    deterministic PricingSuggestion for a date
 *
 * All routes require an authenticated session. Standard { success, data, error,
 * meta } envelope via ok/err. profileId keys the rule; vendorId keys the demand
 * signal — both resolved from the Better Auth userId (they are distinct values).
 */

import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { resolveProfileId } from '../lib/profile.js';
import { db } from '../lib/db.js';
import { vendors } from '@smartshaadi/db';
import {
  CreatePricingRuleSchema,
  UpdatePricingRuleSchema,
  SuggestPriceQuerySchema,
} from '@smartshaadi/schemas';
import {
  createPricingRule,
  listPricingRules,
  updatePricingRule,
  suggestPrice,
  PricingError,
} from './service.js';
import { serializePricingRule, serializePricingSuggestion } from './serialize.js';

export const pricingRouter: Router = Router();

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INVALID_STATE: 422,
  VALIDATION_ERROR: 400,
};

function handlePricingError(res: Response, e: unknown): void {
  if (e instanceof PricingError) {
    err(res, e.code, e.message, STATUS_BY_CODE[e.code] ?? 400);
    return;
  }
  const msg = e instanceof Error ? e.message : 'Unexpected error';
  err(res, 'INTERNAL_ERROR', msg, 500);
}

/** Resolve the caller's vendors.id from their userId (distinct from profileId). */
async function resolveVendorId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);
  return row?.id ?? null;
}

// ── Create ─────────────────────────────────────────────────────────────────────
pricingRouter.post('/rules', authenticate, async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req.user!.id);
  if (!profileId) {
    err(res, 'NO_PROFILE', 'User has no profile', 404);
    return;
  }
  // Inject the resolved profileId so the client never has to send (or spoof) it.
  const parsed = CreatePricingRuleSchema.safeParse({ ...req.body, profileId });
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    const rule = await createPricingRule(profileId, parsed.data);
    ok(res, { rule: serializePricingRule(rule) }, 201);
  } catch (e) {
    handlePricingError(res, e);
  }
});

// ── List ─────────────────────────────────────────────────────────────────────
pricingRouter.get('/rules', authenticate, async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req.user!.id);
  if (!profileId) {
    err(res, 'NO_PROFILE', 'User has no profile', 404);
    return;
  }
  try {
    const rules = await listPricingRules(profileId);
    // Wrapped, not point-free: serializePricingRule takes a second parameter, so
    // `.map(serializePricingRule)` would pass the array index into it.
    ok(res, { rules: rules.map((r) => serializePricingRule(r)), count: rules.length });
  } catch (e) {
    handlePricingError(res, e);
  }
});

// ── Update ─────────────────────────────────────────────────────────────────────
pricingRouter.patch('/rules/:id', authenticate, async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req.user!.id);
  if (!profileId) {
    err(res, 'NO_PROFILE', 'User has no profile', 404);
    return;
  }
  const parsed = UpdatePricingRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    const rule = await updatePricingRule(profileId, req.params.id!, parsed.data);
    ok(res, { rule: serializePricingRule(rule) });
  } catch (e) {
    handlePricingError(res, e);
  }
});

// ── Suggest ─────────────────────────────────────────────────────────────────────
pricingRouter.get('/suggest', authenticate, async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req.user!.id);
  if (!profileId) {
    err(res, 'NO_PROFILE', 'User has no profile', 404);
    return;
  }
  const vendorId = await resolveVendorId(req.user!.id);
  if (!vendorId) {
    err(res, 'NOT_VENDOR', 'User is not a vendor', 403);
    return;
  }
  const parsed = SuggestPriceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const suggestion = await suggestPrice({
      profileId,
      vendorId,
      ruleId: parsed.data.ruleId,
      date: parsed.data.date,
      region: parsed.data.region ?? null,
    });
    ok(res, { suggestion: serializePricingSuggestion(suggestion) });
  } catch (e) {
    handlePricingError(res, e);
  }
});
