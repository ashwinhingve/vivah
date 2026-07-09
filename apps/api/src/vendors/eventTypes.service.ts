/**
 * Smart Shaadi — Vendor Event Types Service (Postgres, routing opt-in)
 *
 * getEventTypes — event types this vendor has opted into for routing
 *                 (apps/api/src/routes/vendorEngine.ts candidate pool)
 * setEventTypes — replace the full set: delete what was removed, upsert the
 *                 rest as available:true, inside one transaction.
 *
 * Both are owner-scoped via assertVendorOwner (vendors/service.ts) — same
 * VENDOR_NOT_FOUND / FORBIDDEN error codes the router already maps to 404/403
 * for the packages CRUD.
 */

import { eq, and, notInArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { vendorEventTypes } from '@smartshaadi/db';
import { assertVendorOwner } from './service.js';
import { EVENT_TYPE_VALUES, type EventTypeValue } from '@smartshaadi/schemas';

function isEventTypeValue(v: string): v is EventTypeValue {
  return (EVENT_TYPE_VALUES as readonly string[]).includes(v);
}

export async function getEventTypes(
  vendorId: string,
  ownerUserId: string,
): Promise<EventTypeValue[]> {
  await assertVendorOwner(vendorId, ownerUserId);
  const rows = await db
    .select({ eventType: vendorEventTypes.eventType })
    .from(vendorEventTypes)
    .where(and(eq(vendorEventTypes.vendorId, vendorId), eq(vendorEventTypes.available, true)));
  return rows.map((r) => r.eventType).filter(isEventTypeValue);
}

export async function setEventTypes(
  vendorId: string,
  ownerUserId: string,
  eventTypes: EventTypeValue[],
): Promise<EventTypeValue[]> {
  await assertVendorOwner(vendorId, ownerUserId);
  const unique = Array.from(new Set(eventTypes));

  await db.transaction(async (tx) => {
    if (unique.length > 0) {
      await tx
        .delete(vendorEventTypes)
        .where(and(
          eq(vendorEventTypes.vendorId, vendorId),
          notInArray(vendorEventTypes.eventType, unique),
        ));
    } else {
      await tx.delete(vendorEventTypes).where(eq(vendorEventTypes.vendorId, vendorId));
    }
    for (const eventType of unique) {
      await tx
        .insert(vendorEventTypes)
        .values({ vendorId, eventType, available: true })
        .onConflictDoUpdate({
          target: [vendorEventTypes.vendorId, vendorEventTypes.eventType],
          set: { available: true },
        });
    }
  });

  return getEventTypes(vendorId, ownerUserId);
}
