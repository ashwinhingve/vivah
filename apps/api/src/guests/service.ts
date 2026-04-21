/**
 * Smart Shaadi — Guests Service
 *
 * getGuestList       — fetch all guests for a wedding (auto-creates guestList if absent)
 * addGuest           — add a single guest; auto-creates guestList on first call
 * bulkImportGuests   — import up to 500 guests in one call
 * updateGuest        — update guest fields (owner-verified)
 * deleteGuest        — remove a guest (owner-verified)
 * updateRsvp         — token-based RSVP update (no auth — public endpoint)
 * getRsvpStats       — aggregated RSVP + meal + room stats for a wedding
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  guestLists,
  guests,
  invitations,
  weddings,
  profiles,
} from '@smartshaadi/db';
import type { AddGuestInput, UpdateGuestInput, RsvpUpdateInput, BulkImportGuestsInput } from '@smartshaadi/schemas';
import type { GuestSummary } from '@smartshaadi/types';

// ── Internal row types ─────────────────────────────────────────────────────────

type GuestRow      = typeof guests.$inferSelect;
type GuestListRow  = typeof guestLists.$inferSelect;

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapGuest(row: GuestRow): GuestSummary {
  return {
    id:           row.id,
    name:         row.name,
    phone:        row.phone ?? null,
    email:        row.email ?? null,
    relationship: row.relationship ?? null,
    rsvpStatus:   row.rsvpStatus as GuestSummary['rsvpStatus'],
    mealPref:     (row.mealPreference !== 'NO_PREFERENCE' ? row.mealPreference : null) as GuestSummary['mealPref'],
    roomNumber:   row.roomNumber ?? null,
  };
}

// ── Ownership helpers ─────────────────────────────────────────────────────────

/** Verify wedding belongs to the given userId (via profileId). Returns the wedding row. */
async function assertWeddingOwner(weddingId: string, userId: string) {
  const rows = await db
    .select({ id: weddings.id, profileId: weddings.profileId })
    .from(weddings)
    .where(eq(weddings.id, weddingId))
    .limit(1);

  const wedding = rows[0];
  if (!wedding) throw Object.assign(new Error('Wedding not found'), { code: 'NOT_FOUND', status: 404 });

  // Resolve the caller's profile id from their Better Auth userId — the weddings
  // table stores profileId, not userId, so a direct compare is always wrong.
  const profileRows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const profileId = profileRows[0]?.id;

  if (!profileId || wedding.profileId !== profileId) {
    throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN', status: 403 });
  }
  return wedding;
}

/** Verify guestList belongs to the given wedding. Returns the guestList row. */
async function assertGuestListOwner(weddingId: string): Promise<GuestListRow> {
  const rows = await db
    .select()
    .from(guestLists)
    .where(eq(guestLists.weddingId, weddingId))
    .limit(1);

  const gl = rows[0];
  if (!gl) throw Object.assign(new Error('Guest list not found'), { code: 'NOT_FOUND', status: 404 });
  return gl;
}

/** Verify guest belongs to guestList. Returns the guest row. */
async function assertGuestOwner(guestId: string, guestListId: string): Promise<GuestRow> {
  const rows = await db
    .select()
    .from(guests)
    .where(and(eq(guests.id, guestId), eq(guests.guestListId, guestListId)))
    .limit(1);

  const guest = rows[0];
  if (!guest) throw Object.assign(new Error('Guest not found'), { code: 'NOT_FOUND', status: 404 });
  return guest;
}

// ── Auto-create guestList ─────────────────────────────────────────────────────

async function ensureGuestList(weddingId: string, userId: string): Promise<GuestListRow> {
  const existing = await db
    .select()
    .from(guestLists)
    .where(eq(guestLists.weddingId, weddingId))
    .limit(1);

  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(guestLists)
    .values({ weddingId, createdBy: userId })
    .returning();

  const gl = inserted[0];
  if (!gl) throw new Error('Failed to create guest list');
  return gl;
}

// ── getGuestList ──────────────────────────────────────────────────────────────

export async function getGuestList(
  weddingId: string,
  userId: string,
): Promise<GuestSummary[]> {
  await assertWeddingOwner(weddingId, userId);

  const gl = await db
    .select()
    .from(guestLists)
    .where(eq(guestLists.weddingId, weddingId))
    .limit(1);

  if (!gl[0]) return [];

  const guestRows = await db
    .select()
    .from(guests)
    .where(eq(guests.guestListId, gl[0].id));

  return guestRows.map(mapGuest);
}

// ── addGuest ──────────────────────────────────────────────────────────────────

export async function addGuest(
  weddingId: string,
  userId: string,
  input: AddGuestInput,
): Promise<GuestSummary> {
  await assertWeddingOwner(weddingId, userId);
  const gl = await ensureGuestList(weddingId, userId);

  const inserted = await db
    .insert(guests)
    .values({
      guestListId:    gl.id,
      name:           input.name,
      phone:          input.phone ?? null,
      email:          input.email ?? null,
      relationship:   input.relationship ?? null,
      mealPreference: (input.mealPref ?? 'NO_PREFERENCE') as GuestRow['mealPreference'],
      roomNumber:     input.roomNumber ?? null,
    })
    .returning();

  const guest = inserted[0];
  if (!guest) throw new Error('Failed to insert guest');
  return mapGuest(guest);
}

// ── bulkImportGuests ──────────────────────────────────────────────────────────

export async function bulkImportGuests(
  weddingId: string,
  userId: string,
  input: BulkImportGuestsInput,
): Promise<{ imported: number; guests: GuestSummary[] }> {
  await assertWeddingOwner(weddingId, userId);
  const gl = await ensureGuestList(weddingId, userId);

  const values = input.guests.map((g) => ({
    guestListId:    gl.id,
    name:           g.name,
    phone:          g.phone ?? null,
    email:          g.email ?? null,
    relationship:   g.relationship ?? null,
    mealPreference: (g.mealPref ?? 'NO_PREFERENCE') as GuestRow['mealPreference'],
    roomNumber:     g.roomNumber ?? null,
  }));

  const inserted = await db.insert(guests).values(values).returning();
  return { imported: inserted.length, guests: inserted.map(mapGuest) };
}

// ── updateGuest ───────────────────────────────────────────────────────────────

export async function updateGuest(
  weddingId: string,
  guestId: string,
  userId: string,
  input: UpdateGuestInput,
): Promise<GuestSummary> {
  await assertWeddingOwner(weddingId, userId);
  const gl = await assertGuestListOwner(weddingId);
  await assertGuestOwner(guestId, gl.id);

  const updateData: Partial<typeof guests.$inferInsert> = {};
  if (input.name !== undefined)        updateData.name = input.name;
  if (input.phone !== undefined)       updateData.phone = input.phone ?? null;
  if (input.email !== undefined)       updateData.email = input.email ?? null;
  if (input.relationship !== undefined) updateData.relationship = input.relationship ?? null;
  if (input.mealPref !== undefined)    updateData.mealPreference = input.mealPref as GuestRow['mealPreference'];
  if (input.roomNumber !== undefined)  updateData.roomNumber = input.roomNumber ?? null;
  if (input.rsvpStatus !== undefined)  updateData.rsvpStatus = input.rsvpStatus as GuestRow['rsvpStatus'];
  updateData.updatedAt = new Date();

  const updated = await db
    .update(guests)
    .set(updateData)
    .where(eq(guests.id, guestId))
    .returning();

  const row = updated[0];
  if (!row) throw Object.assign(new Error('Guest not found'), { code: 'NOT_FOUND', status: 404 });
  return mapGuest(row);
}

// ── deleteGuest ───────────────────────────────────────────────────────────────

export async function deleteGuest(
  weddingId: string,
  guestId: string,
  userId: string,
): Promise<void> {
  await assertWeddingOwner(weddingId, userId);
  const gl = await assertGuestListOwner(weddingId);
  await assertGuestOwner(guestId, gl.id);

  await db.delete(guests).where(eq(guests.id, guestId));
}

// ── updateRsvp (public — token-based) ────────────────────────────────────────

export async function updateRsvp(
  token: string,
  input: RsvpUpdateInput,
): Promise<GuestSummary> {
  // Find invitation by token stored as messageId (token used as messageId/reference)
  const invRows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.messageId, token))
    .limit(1);

  const inv = invRows[0];
  if (!inv) {
    throw Object.assign(new Error('Invalid or expired RSVP token'), { code: 'INVALID_TOKEN', status: 404 });
  }

  const updateData: Partial<typeof guests.$inferInsert> = {
    rsvpStatus: input.rsvpStatus as GuestRow['rsvpStatus'],
    updatedAt:  new Date(),
  };
  if (input.mealPref !== undefined) {
    updateData.mealPreference = input.mealPref as GuestRow['mealPreference'];
  }

  // Mark rsvpAt on the invitation
  await db
    .update(invitations)
    .set({ rsvpAt: new Date() })
    .where(eq(invitations.id, inv.id));

  const updated = await db
    .update(guests)
    .set(updateData)
    .where(eq(guests.id, inv.guestId))
    .returning();

  const row = updated[0];
  if (!row) throw Object.assign(new Error('Guest not found'), { code: 'NOT_FOUND', status: 404 });
  return mapGuest(row);
}

// ── getRsvpStats ──────────────────────────────────────────────────────────────

export interface RsvpStats {
  total:       number;
  confirmed:   number;
  declined:    number;
  pending:     number;
  maybe:       number;
  mealBreakdown: {
    veg:          number;
    nonVeg:       number;
    jain:         number;
    vegan:        number;
    eggetarian:   number;
    noPreference: number;
  };
  roomsAllocated: number;
}

export async function getRsvpStats(
  weddingId: string,
  userId: string,
): Promise<RsvpStats> {
  await assertWeddingOwner(weddingId, userId);

  const gl = await db
    .select({ id: guestLists.id })
    .from(guestLists)
    .where(eq(guestLists.weddingId, weddingId))
    .limit(1);

  if (!gl[0]) {
    return {
      total: 0, confirmed: 0, declined: 0, pending: 0, maybe: 0,
      mealBreakdown: { veg: 0, nonVeg: 0, jain: 0, vegan: 0, eggetarian: 0, noPreference: 0 },
      roomsAllocated: 0,
    };
  }

  const rows = await db
    .select({
      rsvpStatus:     guests.rsvpStatus,
      mealPreference: guests.mealPreference,
      roomNumber:     guests.roomNumber,
    })
    .from(guests)
    .where(eq(guests.guestListId, gl[0].id));

  const stats: RsvpStats = {
    total:       rows.length,
    confirmed:   0,
    declined:    0,
    pending:     0,
    maybe:       0,
    mealBreakdown: { veg: 0, nonVeg: 0, jain: 0, vegan: 0, eggetarian: 0, noPreference: 0 },
    roomsAllocated: 0,
  };

  for (const r of rows) {
    switch (r.rsvpStatus) {
      case 'YES':     stats.confirmed++;   break;
      case 'NO':      stats.declined++;    break;
      case 'PENDING': stats.pending++;     break;
      case 'MAYBE':   stats.maybe++;       break;
    }
    switch (r.mealPreference) {
      case 'VEG':           stats.mealBreakdown.veg++;          break;
      case 'NON_VEG':       stats.mealBreakdown.nonVeg++;       break;
      case 'JAIN':          stats.mealBreakdown.jain++;         break;
      case 'VEGAN':         stats.mealBreakdown.vegan++;        break;
      case 'EGGETARIAN':    stats.mealBreakdown.eggetarian++;   break;
      case 'NO_PREFERENCE': stats.mealBreakdown.noPreference++; break;
    }
    if (r.roomNumber) stats.roomsAllocated++;
  }

  return stats;
}

