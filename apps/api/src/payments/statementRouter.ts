/**
 * Smart Shaadi — Payment Statement Router.
 *
 * GET /payments/statement?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { StatementQuerySchema } from '@smartshaadi/schemas';
import { getStatement } from './statement.js';

export const statementRouter = Router();

statementRouter.get('/', authenticate, async (req: Request, res: Response) => {
  const parse = StatementQuerySchema.safeParse({
    fromDate: req.query['fromDate'],
    toDate:   req.query['toDate'],
  });
  if (!parse.success) {
    return err(res, 'VALIDATION_ERROR', parse.error.issues[0]?.message ?? 'Invalid date range', 422);
  }
  try {
    const stmt = await getStatement(req.user!.id, parse.data.fromDate, parse.data.toDate);
    ok(res, stmt);
  } catch (e) {
    err(res, 'INTERNAL', e instanceof Error ? e.message : 'Statement error', 500);
  }
});
