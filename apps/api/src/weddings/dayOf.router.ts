/**
 * Smart Shaadi — Day-of router
 */

import { Router, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  GuestArrivalCheckInSchema, VendorCheckInSchema, UpdateCeremonyStatusSchema,
} from '@smartshaadi/schemas';
import * as dayOf from './dayOf.service.js';

interface AppError extends Error { code?: string; status?: number; }

function handle(res: Response, e: unknown, fallback: string): void {
  const ae = e as AppError;
  err(res, ae.code ?? fallback, ae instanceof Error ? ae.message : 'Unknown', ae.status ?? 500);
}

export const weddingDayOfRouter = Router({ mergeParams: true });

weddingDayOfRouter.get('/:id/day-of/snapshot', authenticate, async (req, res) => {
  try { ok(res, await dayOf.getDayOfSnapshot(req.params['id']!, req.user!.id)); }
  catch (e) { handle(res, e, 'DAYOF_SNAPSHOT_ERROR'); }
});

weddingDayOfRouter.post('/:id/day-of/guests/:guestId/check-in', authenticate, async (req, res) => {
  const parsed = GuestArrivalCheckInSchema.safeParse(req.body ?? {});
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try {
    const at = parsed.data.arrivedAt ? new Date(parsed.data.arrivedAt) : null;
    ok(res, await dayOf.checkInGuest(req.params['id']!, req.user!.id, req.params['guestId']!, at));
  } catch (e) { handle(res, e, 'GUEST_CHECKIN_ERROR'); }
});

weddingDayOfRouter.post('/:id/day-of/timeline/:eventId/check-in', authenticate, async (req, res) => {
  const parsed = VendorCheckInSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await dayOf.vendorCheckIn(req.params['id']!, req.user!.id, req.params['eventId']!, parsed.data.checkedIn)); }
  catch (e) { handle(res, e, 'VENDOR_CHECKIN_ERROR'); }
});

weddingDayOfRouter.put('/:id/day-of/ceremonies/:ceremonyId/status', authenticate, async (req, res) => {
  const parsed = UpdateCeremonyStatusSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await dayOf.setCeremonyStatus(req.params['id']!, req.user!.id, req.params['ceremonyId']!, parsed.data.status)); }
  catch (e) { handle(res, e, 'CEREMONY_STATUS_ERROR'); }
});
