import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import {
  exportPaymentsCsv,
  exportRefundsCsv,
  exportPayoutsCsv,
  exportRevenueCsv,
} from './csvExport.js';

export const csvExportRouter = Router();

function parseRange(req: Request): { from: Date; to: Date } | null {
  const fromStr = req.query['from'];
  const toStr   = req.query['to'];
  if (typeof fromStr !== 'string' || typeof toStr !== 'string') return null;
  const from = new Date(fromStr);
  const to   = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  return { from, to };
}

function send(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

csvExportRouter.get('/payments.csv', authenticate, authorize(['ADMIN']), async (req, res) => {
  const r = parseRange(req); if (!r) { res.status(400).send('from and to query params required'); return; }
  send(res, `payments_${r.from.toISOString().slice(0,10)}_${r.to.toISOString().slice(0,10)}.csv`, await exportPaymentsCsv(r));
});

csvExportRouter.get('/refunds.csv', authenticate, authorize(['ADMIN']), async (req, res) => {
  const r = parseRange(req); if (!r) { res.status(400).send('from and to query params required'); return; }
  send(res, `refunds_${r.from.toISOString().slice(0,10)}_${r.to.toISOString().slice(0,10)}.csv`, await exportRefundsCsv(r));
});

csvExportRouter.get('/payouts.csv', authenticate, authorize(['ADMIN']), async (req, res) => {
  const r = parseRange(req); if (!r) { res.status(400).send('from and to query params required'); return; }
  send(res, `payouts_${r.from.toISOString().slice(0,10)}_${r.to.toISOString().slice(0,10)}.csv`, await exportPayoutsCsv(r));
});

csvExportRouter.get('/revenue.csv', authenticate, authorize(['ADMIN']), async (req, res) => {
  const r = parseRange(req); if (!r) { res.status(400).send('from and to query params required'); return; }
  send(res, `revenue_${r.from.toISOString().slice(0,10)}_${r.to.toISOString().slice(0,10)}.csv`, await exportRevenueCsv(r));
});
