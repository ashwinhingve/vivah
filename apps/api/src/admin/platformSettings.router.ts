/**
 * Admin Platform Settings router — global feature toggles.
 *
 * Routes:
 *   GET    /api/v1/admin/platform-settings
 *   PATCH  /api/v1/admin/platform-settings/:key   body: { value: unknown }
 *
 * Both routes require ADMIN session. Every PATCH appends a row to audit_logs
 * with eventType=PLATFORM_SETTING_CHANGED so changes are auditable.
 *
 * Validation:
 *   lgbtq_matching_enabled must be a boolean. Any other key is accepted as-is
 *   (no platform-wide schema for arbitrary settings) — extend KEY_VALIDATORS
 *   when new toggles ship.
 */

import { Router, type Request, type Response } from 'express';
import { createHash } from 'node:crypto';
import { eq, desc } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { logger } from '../lib/logger.js';
import { db } from '../lib/db.js';
import { auditLogs } from '@smartshaadi/db';
import {
  listPlatformSettings,
  setPlatformSetting,
} from '../services/platformSettingsService.js';

function hashChain(payload: unknown, prevHash: string | null): string {
  return createHash('sha256')
    .update(JSON.stringify(payload) + (prevHash ?? ''))
    .digest('hex');
}

export const platformSettingsRouter = Router();

/**
 * Public read of user-visible platform flags. No auth required so the
 * profile UI can decide which gender/orientation controls to render.
 * Only flags that are explicitly user-facing are exposed here.
 */
export const platformSettingsPublicRouter = Router();
platformSettingsPublicRouter.get(
  '/platform-settings/public',
  async (_req: Request, res: Response) => {
    try {
      const { isLGBTQMatchingEnabled } = await import('../services/platformSettingsService.js');
      const lgbtqEnabled = await isLGBTQMatchingEnabled();
      return ok(res, { lgbtqEnabled });
    } catch (e) {
      logger.error({ err: e }, 'platform-settings public read failed');
      return err(res, 'SERVER_ERROR', 'Failed to read platform settings', 500);
    }
  },
);

// Audit chain uses uuid entityId. Platform settings are not uuid-keyed, so
// every PLATFORM_SETTING_CHANGED row shares the same synthetic entity uuid
// (the key + value live in payload). This keeps the chained hash per-entity
// well-defined while letting us audit a string-keyed table.
const PLATFORM_SETTINGS_ENTITY_ID = '00000000-0000-0000-0000-000000000001';

type KeyValidator = (value: unknown) => { ok: true } | { ok: false; reason: string };

const KEY_VALIDATORS: Record<string, KeyValidator> = {
  lgbtq_matching_enabled: (v) =>
    typeof v === 'boolean'
      ? { ok: true }
      : { ok: false, reason: 'lgbtq_matching_enabled must be a boolean' },
};

platformSettingsRouter.get(
  '/platform-settings',
  authenticate,
  authorize(['ADMIN']),
  async (_req: Request, res: Response) => {
    try {
      const rows = await listPlatformSettings();
      return ok(res, { settings: rows });
    } catch (e) {
      logger.error({ err: e }, 'platform-settings list failed');
      return err(res, 'SERVER_ERROR', 'Failed to list platform settings', 500);
    }
  },
);

platformSettingsRouter.patch(
  '/platform-settings/:key',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response) => {
    const key = req.params.key;
    const adminUserId = req.user?.id;
    if (!adminUserId) return err(res, 'UNAUTHORIZED', 'Auth required', 401);
    if (!key || key.length > 100) {
      return err(res, 'BAD_REQUEST', 'Invalid key', 400);
    }

    const body = req.body as { value?: unknown } | undefined;
    if (!body || !('value' in body)) {
      return err(res, 'BAD_REQUEST', 'Missing body.value', 400);
    }
    const value = body.value;

    const validator = KEY_VALIDATORS[key];
    if (validator) {
      const result = validator(value);
      if (!result.ok) return err(res, 'BAD_REQUEST', result.reason, 400);
    }

    try {
      await setPlatformSetting(key, value, adminUserId);

      // Audit chain — hash includes prev hash for tamper-evidence.
      const [lastLog] = await db
        .select({ contentHash: auditLogs.contentHash })
        .from(auditLogs)
        .where(eq(auditLogs.entityId, PLATFORM_SETTINGS_ENTITY_ID))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);
      const prevHash = lastLog?.contentHash ?? null;
      const payload = { key, value };
      const contentHash = hashChain(payload, prevHash);
      await db.insert(auditLogs).values({
        eventType: 'PLATFORM_SETTING_CHANGED',
        entityType: 'platform_setting',
        entityId: PLATFORM_SETTINGS_ENTITY_ID,
        actorId: adminUserId,
        payload,
        contentHash,
        prevHash,
      });

      return ok(res, { key, value });
    } catch (e) {
      logger.error({ err: e, key }, 'platform-settings patch failed');
      return err(res, 'SERVER_ERROR', 'Failed to update platform setting', 500);
    }
  },
);

