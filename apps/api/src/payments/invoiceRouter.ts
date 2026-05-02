/**
 * Smart Shaadi — Invoice Router.
 *
 * GET  /invoices                       → my invoices list
 * GET  /invoices/:id                   → single invoice (must own)
 * GET  /invoices/admin/list            → admin all (?from=&to=)
 * POST /invoices/admin/:id/cancel      → admin cancel + optional credit note
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  listMyInvoices,
  getInvoice,
  adminListInvoices,
  cancelInvoice,
  InvoiceError,
} from './invoiceService.js';

export const invoiceRouter = Router();

function handle(res: Response, e: unknown) {
  if (e instanceof InvoiceError) {
    const map: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, ALREADY_CANCELLED: 422, NO_ITEMS: 422 };
    return err(res, e.code, e.message, map[e.code] ?? 400);
  }
  err(res, 'INTERNAL', e instanceof Error ? e.message : 'Invoice error', 500);
}

invoiceRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await listMyInvoices(req.user!.id);
    ok(res, { items });
  } catch (e) { handle(res, e); }
});

invoiceRouter.get('/admin/list', authenticate, async (req: Request, res: Response) => {
  const fromDate = (req.query['fromDate'] as string | undefined) ?? undefined;
  const toDate   = (req.query['toDate']   as string | undefined) ?? undefined;
  try {
    const items = await adminListInvoices(req.user!.id, fromDate, toDate);
    ok(res, { items });
  } catch (e) { handle(res, e); }
});

invoiceRouter.post('/admin/:id/cancel', authenticate, async (req: Request, res: Response) => {
  const id = req.params['id'];
  if (!id) return err(res, 'VALIDATION_ERROR', 'id required', 422);
  const issueCredit = req.body?.issueCreditNote === true;
  try {
    const result = await cancelInvoice(req.user!.id, id, issueCredit);
    ok(res, { cancelled: true, creditNote: result });
  } catch (e) { handle(res, e); }
});

invoiceRouter.get('/:id', authenticate, async (req: Request, res: Response) => {
  const id = req.params['id'];
  if (!id) return err(res, 'VALIDATION_ERROR', 'id required', 422);
  try {
    const inv = await getInvoice(id, req.user!.id);
    ok(res, inv);
  } catch (e) { handle(res, e); }
});
