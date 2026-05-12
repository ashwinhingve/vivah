/**
 * Referral Programme HTTP routes (Tier 3 Track 1).
 *
 * GET  /api/v1/referral/my-code      — auth, lazy-creates the user's code
 * GET  /api/v1/referral/my-activity  — auth, code + total credits + referrals
 * GET  /api/v1/referral/validate/:code — public, returns { valid, referrer_name? }
 *
 * Mounted via routes/_p3Register.ts alongside assistant + vendor-engine.
 */
import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { user as userTable, referralCodes } from '@smartshaadi/db';
import { authenticate } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import {
  generateCodeForUser,
  validateCode,
  getMyReferralActivity,
} from '../services/referralService.js';

export const referralRouter = Router();

referralRouter.get(
  '/my-code',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const code = await generateCodeForUser(userId);
    ok(res, {
      code:       code.code,
      uses_count: code.usesCount,
      is_active:  code.isActive,
      created_at: code.createdAt.toISOString(),
      expires_at: code.expiresAt ? code.expiresAt.toISOString() : null,
    });
  }),
);

referralRouter.get(
  '/my-activity',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const activity = await getMyReferralActivity(userId);
    ok(res, {
      code: activity.code
        ? {
            code:       activity.code.code,
            uses_count: activity.code.usesCount,
            is_active:  activity.code.isActive,
            created_at: activity.code.createdAt.toISOString(),
          }
        : null,
      total_credits: activity.totalCredits,
      referrals: activity.referrals.map((r) => ({
        id:                    r.id,
        status:                r.status,
        reward_credited:       r.rewardCredited,
        reward_amount_credits: r.rewardAmountCredits,
        referred_name:         maskName(r.referredName),
        created_at:            r.createdAt.toISOString(),
        converted_at:          r.convertedAt ? r.convertedAt.toISOString() : null,
      })),
    });
  }),
);

referralRouter.get(
  '/validate/:code',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const codeParam = req.params['code'];
    if (!codeParam || codeParam.length < 4 || codeParam.length > 12) {
      err(res, 'VALIDATION_ERROR', 'Code must be 4-12 characters', 400);
      return;
    }
    const row = await validateCode(codeParam);
    if (!row) {
      ok(res, { valid: false });
      return;
    }
    const [owner] = await db
      .select({ name: userTable.name })
      .from(referralCodes)
      .leftJoin(userTable, eq(userTable.id, referralCodes.ownerUserId))
      .where(eq(referralCodes.id, row.id))
      .limit(1);
    ok(res, {
      valid: true,
      referrer_name: owner?.name ? maskName(owner.name) : null,
    });
  }),
);

function maskName(name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  const first = parts[0]!;
  const lastInitial = parts.length > 1 ? `${parts[parts.length - 1]![0]}.` : '';
  return lastInitial ? `${first} ${lastInitial}` : first;
}
