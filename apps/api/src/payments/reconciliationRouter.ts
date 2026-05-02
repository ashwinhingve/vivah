import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  listDiscrepancies,
  markResolved,
  ReconciliationError,
} from './reconciliation.js';
import * as schema from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { eq } from 'drizzle-orm';

export const reconciliationRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof ReconciliationError) {
    const map: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Reconciliation error', 500);
}

async function assertAdmin(userId: string): Promise<boolean> {
  const [u] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  return u?.role === 'ADMIN';
}

reconciliationRouter.get('/admin/reconciliation', authenticate, async (req: Request, res: Response) => {
  if (!(await assertAdmin(req.user!.id))) return err(res, 'FORBIDDEN', 'Admin only', 403);
  const status = req.query['status'] as string | undefined;
  try {
    ok(res, { items: await listDiscrepancies(status) });
  } catch (e) { handle(res, e); }
});

reconciliationRouter.post('/admin/reconciliation/:id/resolve', authenticate, async (req: Request, res: Response) => {
  if (!(await assertAdmin(req.user!.id))) return err(res, 'FORBIDDEN', 'Admin only', 403);
  const { notes } = req.body as { notes?: string };
  try {
    ok(res, await markResolved(req.params['id']!, notes ?? ''));
  } catch (e) { handle(res, e); }
});
