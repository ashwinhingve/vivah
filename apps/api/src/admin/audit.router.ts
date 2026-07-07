/**
 * Admin Audit Log router — read-only view into the append-only, hash-chained
 * `audit_logs` table (packages/db/schema/index.ts) for compliance/moderation
 * review. Never inserts/updates here — writes only ever happen through
 * `appendAuditLog` (apps/api/src/payments/service.ts) so the hash chain stays
 * intact.
 *
 * Routes (mounted at /api/v1/admin):
 *   GET /audit                              list + filter, paginated
 *   GET /audit/:entityType/:entityId/verify re-verify the hash chain for one entity
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { db } from '../lib/db.js';
import { auditLogs, auditEventTypeEnum, user } from '@smartshaadi/db';
import { ok, err } from '../lib/response.js';
import { verifyEntityChain } from '../jobs/auditChainVerifierJob.js';

export const adminAuditRouter = Router();

// ---------------------------------------------------------------------------
// GET /admin/audit — filtered, paginated audit trail
// ---------------------------------------------------------------------------

const AuditQuerySchema = z.object({
  eventType:  z.enum(auditEventTypeEnum.enumValues).optional(),
  entityType: z.string().trim().optional(),
  entityId:   z.string().uuid().optional(),
  actorId:    z.string().trim().optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
});

adminAuditRouter.get(
  '/audit',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = AuditQuerySchema.safeParse(req.query);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    const { eventType, entityType, entityId, actorId, from, to, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (eventType)  conditions.push(eq(auditLogs.eventType, eventType));
    if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
    if (entityId)   conditions.push(eq(auditLogs.entityId, entityId));
    if (actorId)    conditions.push(eq(auditLogs.actorId, actorId));
    if (from)       conditions.push(gte(auditLogs.createdAt, from));
    if (to)         conditions.push(lte(auditLogs.createdAt, to));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id:         auditLogs.id,
        eventType:  auditLogs.eventType,
        entityType: auditLogs.entityType,
        entityId:   auditLogs.entityId,
        actorId:    auditLogs.actorId,
        actorName:  user.name,
        payload:    auditLogs.payload,
        createdAt:  auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.actorId, user.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);
    const total = countRow?.count ?? 0;

    ok(res, { items: rows, total, page, limit });
  },
);

// ---------------------------------------------------------------------------
// GET /admin/audit/:entityType/:entityId/verify — hash-chain integrity check
// ---------------------------------------------------------------------------

const EntityParamsSchema = z.object({
  entityType: z.string().trim().min(1),
  entityId:   z.string().uuid(),
});

adminAuditRouter.get(
  '/audit/:entityType/:entityId/verify',
  authenticate,
  authorize(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = EntityParamsSchema.safeParse(req.params);
    if (!parsed.success) { err(res, 'BAD_REQUEST', parsed.error.message, 400); return; }
    // entityType is part of the URL for readability; verifyEntityChain keys
    // purely off entityId (audit_entity_idx already covers entityType+entityId
    // for the list query above, but the chain itself is per-entityId).
    const result = await verifyEntityChain(parsed.data.entityId);
    ok(res, result);
  },
);
