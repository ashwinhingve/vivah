/**
 * Smart Shaadi — Wedding incidents router
 */

import { Router, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { CreateIncidentSchema, ResolveIncidentSchema } from '@smartshaadi/schemas';
import * as incidents from './incidents.service.js';

interface AppError extends Error { code?: string; status?: number; }

function handle(res: Response, e: unknown, fallback: string): void {
  const ae = e as AppError;
  err(res, ae.code ?? fallback, ae instanceof Error ? ae.message : 'Unknown', ae.status ?? 500);
}

export const weddingIncidentsRouter = Router({ mergeParams: true });

weddingIncidentsRouter.get('/:id/incidents', authenticate, async (req, res) => {
  const open = req.query['open'] === '1' || req.query['open'] === 'true';
  const severity = (req.query['severity'] as string | undefined)?.toUpperCase();
  try {
    const filter: { open?: boolean; severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } = {};
    if (open) filter.open = true;
    if (severity && ['LOW','MEDIUM','HIGH','CRITICAL'].includes(severity)) {
      filter.severity = severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }
    const list = await incidents.listIncidents(req.params['id']!, req.user!.id, filter);
    ok(res, { incidents: list });
  } catch (e) { handle(res, e, 'INCIDENT_LIST_ERROR'); }
});

weddingIncidentsRouter.post('/:id/incidents', authenticate, async (req, res) => {
  const parsed = CreateIncidentSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await incidents.createIncident(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'INCIDENT_CREATE_ERROR'); }
});

weddingIncidentsRouter.post('/:id/incidents/:incidentId/resolve', authenticate, async (req, res) => {
  const parsed = ResolveIncidentSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await incidents.resolveIncident(req.params['id']!, req.user!.id, req.params['incidentId']!, parsed.data)); }
  catch (e) { handle(res, e, 'INCIDENT_RESOLVE_ERROR'); }
});
