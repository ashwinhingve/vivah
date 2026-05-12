/**
 * Vendor engine routes — /api/v1/vendor-engine/*
 *
 *   GET  /vendors/:vendorId/pipeline  — vendor owner OR admin
 *   POST /route                       — admin / coordinator only
 *
 * Foundation layer for cross-event vendor utilization. Full vendor
 * utilization analytics ship in Phase 5; this module unblocks (1) showing
 * vendors their multi-event booking pipeline and (2) routing a proposed
 * event to the best-fit vendors during admin/coordinator workflows.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, gte, inArray } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { vendors, vendorEventTypes, bookings } from '@smartshaadi/db';
import { routeVendorToEvent, type EventType } from '../services/vendorEngine/eventRouter.js';
import { getVendorUtilization } from '../services/vendorEngine/availabilityScorer.js';

export const vendorEngineRouter = Router();

const EVENT_TYPE_VALUES = [
  'WEDDING', 'CORPORATE', 'FESTIVAL', 'COMMUNITY_EVENT', 'COMMUNITY',
  'GOVERNMENT', 'SCHOOL', 'OTHER', 'HALDI', 'MEHNDI', 'SANGEET',
  'ENGAGEMENT', 'RECEPTION',
] as const;

const RouteSchema = z.object({
  event_type:     z.enum(EVENT_TYPE_VALUES),
  event_date:     z.string().refine(s => !Number.isNaN(Date.parse(s)), 'invalid date'),
  event_location: z
    .object({
      city:  z.string().trim().min(1).max(100).optional().nullable(),
      state: z.string().trim().min(1).max(100).optional().nullable(),
    })
    .optional()
    .default({}),
});

// ── GET /vendors/:vendorId/pipeline ───────────────────────────────────────────

vendorEngineRouter.get(
  '/vendors/:vendorId/pipeline',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const vendorIdParam = req.params['vendorId'];
    const vendorId = z.string().uuid().safeParse(vendorIdParam);
    if (!vendorId.success) {
      err(res, 'VALIDATION_ERROR', 'vendorId must be a UUID', 400);
      return;
    }

    const [vendor] = await db
      .select({
        id:           vendors.id,
        userId:       vendors.userId,
        businessName: vendors.businessName,
      })
      .from(vendors)
      .where(eq(vendors.id, vendorId.data))
      .limit(1);

    if (!vendor) {
      err(res, 'NOT_FOUND', 'Vendor not found', 404);
      return;
    }

    const role = req.user!.role;
    const isOwner   = vendor.userId === req.user!.id;
    const isStaff   = role === 'ADMIN' || role === 'SUPPORT';
    if (!isOwner && !isStaff) {
      err(res, 'FORBIDDEN', 'Not allowed to view this vendor pipeline', 403);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const [upcoming, utilization] = await Promise.all([
      db.select({
          id:           bookings.id,
          eventDate:    bookings.eventDate,
          ceremonyType: bookings.ceremonyType,
          status:       bookings.status,
          totalAmount:  bookings.totalAmount,
          guestCount:   bookings.guestCount,
          eventLocation: bookings.eventLocation,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.vendorId, vendorId.data),
            gte(bookings.eventDate, today),
            inArray(bookings.status, ['PENDING', 'CONFIRMED']),
          ),
        ),
      getVendorUtilization(vendorId.data),
    ]);

    ok(res, {
      vendor: {
        id:           vendor.id,
        businessName: vendor.businessName,
      },
      upcoming,
      utilization,
    });
  }),
);

// ── POST /route ───────────────────────────────────────────────────────────────

vendorEngineRouter.post(
  '/route',
  authenticate,
  authorize(['ADMIN', 'SUPPORT', 'EVENT_COORDINATOR']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parsed = RouteSchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    const { event_type, event_date, event_location } = parsed.data;
    const eventDate = new Date(event_date);
    const eventType = event_type as EventType;

    // Candidate set: vendors that have explicitly enabled this event type
    // and are active. Cap at 200 candidates to keep the per-call fanout
    // bounded; admin tooling can refine results from the top of the ranking.
    const candidates = await db
      .select({ vendorId: vendorEventTypes.vendorId })
      .from(vendorEventTypes)
      .innerJoin(vendors, eq(vendors.id, vendorEventTypes.vendorId))
      .where(
        and(
          eq(vendorEventTypes.eventType, event_type),
          eq(vendorEventTypes.available, true),
          eq(vendors.isActive, true),
        ),
      )
      .limit(200);

    const results = await Promise.all(
      candidates.map(c =>
        routeVendorToEvent(c.vendorId, eventType, eventDate, event_location ?? {}),
      ),
    );

    const ranked = results
      .filter(r => r.routable)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    ok(res, { count: ranked.length, vendors: ranked });
  }),
);
