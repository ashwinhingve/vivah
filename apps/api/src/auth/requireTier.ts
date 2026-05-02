/**
 * Smart Shaadi — Premium tier gate middleware
 * apps/api/src/auth/requireTier.ts
 *
 * Use AFTER `authenticate`. Returns 403 with `{ upgradeRequired, requiredTier }`
 * when the user's tier is insufficient.
 *
 *   router.get('/likes', authenticate, requireTier('PREMIUM', 'who_liked_me'), handler);
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { PremiumTier } from '@smartshaadi/types';
import { getProfileTier, tierAtLeast } from '../lib/entitlements.js';
import { err } from '../lib/response.js';

export function requireTier(required: PremiumTier, feature: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      err(res, 'UNAUTHORIZED', 'Not authenticated', 401);
      return;
    }
    const resolved = await getProfileTier(userId);
    if (!resolved) {
      err(res, 'PROFILE_NOT_FOUND', 'Profile not found', 404);
      return;
    }
    if (!tierAtLeast(resolved.tier, required)) {
      res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'UPGRADE_REQUIRED',
          message: `${feature} requires ${required} tier`,
          upgradeRequired: true,
          requiredTier: required,
          feature,
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }
    next();
  };
}
