/**
 * Smart Shaadi — Guests Service
 *
 * getGuestList       — fetch all guests for a wedding (auto-creates guestList if absent)
 * getGuestRich       — fetch single rich guest
 * addGuest           — add a single guest with all rich fields; auto-creates guestList
 * bulkImportGuests   — import up to 500 guests in one call
 * updateGuest        — update guest rich fields (owner-verified)
 * deleteGuest        — remove a guest (owner-verified)
 * updateRsvp         — token-based RSVP update; consolidates rsvp_tokens + invitations.messageId
 * checkInGuest       — mark guest arrived at wedding day
 * getRsvpStats       — aggregated RSVP + meal + room stats for a wedding
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  guestLists,
  guests,
  invitations,
  rsvpTokens,
  weddings,
  profiles,
} from '@smartshaadi/db';
import type {
  AddGuestInput,
  UpdateGuestInput,
  RsvpUpdateInput,
  BulkImportGuestsInput,
  RichUpdateGuestInput,
} from '@smartshaadi/schemas';
import type { GuestSummary, GuestRich } from '@smartshaadi/types';
import { logActivity } from '../weddings/activity.service.js';

// ── Internal row types ─────────────────────────────────────────────────────────

type GuestRow      = typeof guests.$inferSelect;
type GuestListRow  = typeof guestLists.$inferSelect;

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapGuestSide(s: string | null): GuestRich['side'] {
  if (s === 'BRIDE' || s === 'GROOM' || s === 'BOTH') return s;
  return null;
}

function mapAgeGroup(s: string): GuestRich['ageGroup'] {
  if (s === 'CHILD' || s === 'INFANT') return s;
  return 'ADULT';
}

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

function mapGuestRich(row: GuestRow): GuestRich {
  return {
    ...mapGuest(row),
    side:                mapGuestSide(row.side ?? null),
    plusOnes:            row.plusOnes ?? 0,
    plusOneNames:        (row.plusOneNames as string[] | null) ?? [],
    ageGroup:            mapAgeGroup(row.ageGroup),
    isVip:               row.isVip ?? false,
    dietaryNotes:        row.dietaryNotes ?? null,
    accessibilityNotes:  row.accessibilityNotes ?? null,
    invitedToCeremonies: row.invitedToCeremonies ?? [],
    notes:               row.notes ?? null,
    arrivedAt:           row.arrivedAt ? row.arrivedAt.toISOString() : null,
    checkedInBy:         row.checkedInBy ?? null,
    createdAt:           row.createdAt.toISOString(),
    updatedAt:           row.updatedAt.toISOString(),
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

// ── Insert payload builder (shared by add + bulk) ─────────────────────────────

function buildGuestInsert(
  guestListId: string,
  input: AddGuestInput,
): typeof guests.$inferInsert {
  return {
    guestListId,
    name:                input.name,
    phone:               input.phone ?? null,
    email:               input.email ?? null,
    relationship:        input.relationship ?? null,
    side:                input.side ?? null,
    mealPreference:      (input.mealPref ?? 'NO_PREFERENCE') as GuestRow['mealPreference'],
    roomNumber:          input.roomNumber ?? null,
    plusOnes:            input.plusOnes ?? 0,
    plusOneNames:        input.plusOneNames ?? null,
    ageGroup:            input.ageGroup ?? 'ADULT',
    isVip:               input.isVip ?? false,
    dietaryNotes:        input.dietaryNotes ?? null,
    accessibilityNotes:  input.accessibilityNotes ?? null,
    invitedToCeremonies: input.invitedToCeremonies ?? null,
    notes:               input.notes ?? null,
  };
}

// ── getGuestList ──────────────────────────────────────────────────────────────

export async function getGuestList(
  weddingId: string,
  userId: string,
): Promise<GuestRich[]> {
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

  return guestRows.map(mapGuestRich);
}

// ── getGuestRich ──────────────────────────────────────────────────────────────

export async function getGuestRich(
  weddingId: string,
  guestId: string,
  userId: string,
): Promise<GuestRich> {
  await assertWeddingOwner(weddingId, userId);
  const gl = await assertGuestListOwner(weddingId);
  const row = await assertGuestOwner(guestId, gl.id);
  return mapGuestRich(row);
}

// ── addGuest ──────────────────────────────────────────────────────────────────

export async function addGuest(
  weddingId: string,
  userId: string,
  input: AddGuestInput,
): Promise<GuestRich> {
  await assertWeddingOwner(weddingId, userId);
  const gl = await ensureGuestList(weddingId, userId);

  const inserted = await db
    .insert(guests)
    .values(buildGuestInsert(gl.id, input))
    .returning();

  const guest = inserted[0];
  if (!guest) throw new Error('Failed to insert guest');
  await logActivity(weddingId, userId, 'guest.add', 'guest', guest.id, { name: guest.name });
  return mapGuestRich(guest);
}

// ── bulkImportGuests ──────────────────────────────────────────────────────────

export async function bulkImportGuests(
  weddingId: string,
  userId: string,
  input: BulkImportGuestsInput,
): Promise<{ imported: number; guests: GuestRich[] }> {
  await assertWeddingOwner(weddingId, userId);
  const gl = await ensureGuestList(weddingId, userId);

  const values = input.guests.map((g) => buildGuestInsert(gl.id, g));

  const inserted = await db.insert(guests).values(values).returning();
  await logActivity(weddingId, userId, 'guest.bulkImport', 'guest', undefined, { count: inserted.length });
  return { imported: inserted.length, guests: inserted.map(mapGuestRich) };
}

// ── updateGuest ───────────────────────────────────────────────────────────────

export async function updateGuest(
  weddingId: string,
  guestId: string,
  userId: string,
  input: UpdateGuestInput | RichUpdateGuestInput,
): Promise<GuestRich> {
  await assertWeddingOwner(weddingId, userId);
  const gl = await assertGuestListOwner(weddingId);
  await assertGuestOwner(guestId, gl.id);

  const updateData: Partial<typeof guests.$inferInsert> = {};
  if ('name' in input && input.name !== undefined) updateData.name = input.name;
  if ('phone' in input && input.phone !== undefined) updateData.phone = input.phone ?? null;
  if ('email' in input && input.email !== undefined) updateData.email = input.email ?? null;
  if ('relationship' in input && input.relationship !== undefined) updateData.relationship = input.relationship ?? null;
  if ('side' in input && input.side !== undefined) updateData.side = input.side ?? null;
  if ('mealPref' in input && input.mealPref !== undefined) updateData.mealPreference = input.mealPref as GuestRow['mealPreference'];
  if ('roomNumber' in input && input.roomNumber !== undefined) updateData.roomNumber = input.roomNumber ?? null;
  if ('rsvpStatus' in input && input.rsvpStatus !== undefined) updateData.rsvpStatus = input.rsvpStatus as GuestRow['rsvpStatus'];
  if ('plusOnes' in input && input.plusOnes !== undefined) updateData.plusOnes = input.plusOnes;
  if ('plusOneNames' in input && input.plusOneNames !== undefined) updateData.plusOneNames = input.plusOneNames;
  if ('ageGroup' in input && input.ageGroup !== undefined) updateData.ageGroup = input.ageGroup;
  if ('isVip' in input && input.isVip !== undefined) updateData.isVip = input.isVip;
  if ('dietaryNotes' in input && input.dietaryNotes !== undefined) updateData.dietaryNotes = input.dietaryNotes ?? null;
  if ('accessibilityNotes' in input && input.accessibilityNotes !== undefined) updateData.accessibilityNotes = input.accessibilityNotes ?? null;
  if ('invitedToCeremonies' in input && input.invitedToCeremonies !== undefined) updateData.invitedToCeremonies = input.invitedToCeremonies;
  if ('notes' in input && input.notes !== undefined) updateData.notes = input.notes ?? null;
  updateData.updatedAt = new Date();

  const updated = await db
    .update(guests)
    .set(updateData)
    .where(and(eq(guests.id, guestId), eq(guests.guestListId, gl.id)))
    .returning();

  const row = updated[0];
  if (!row) throw Object.assign(new Error('Guest not found'), { code: 'NOT_FOUND', status: 404 });
  await logActivity(weddingId, userId, 'guest.update', 'guest', guestId, { fields: Object.keys(updateData) });
  return mapGuestRich(row);
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

  await db.delete(guests).where(and(eq(guests.id, guestId), eq(guests.guestListId, gl.id)));
  await logActivity(weddingId, userId, 'guest.delete', 'guest', guestId);
}

// ── checkInGuest ──────────────────────────────────────────────────────────────

export async function checkInGuest(
  weddingId: string,
  guestId: string,
  userId: string,
  checkedIn: boolean = true,
): Promise<GuestRich> {
  await assertWeddingOwner(weddingId, userId);
  const gl = await assertGuestListOwner(weddingId);
  await assertGuestOwner(guestId, gl.id);

  const updated = await db
    .update(guests)
    .set({
      arrivedAt:   checkedIn ? new Date() : null,
      checkedInBy: checkedIn ? userId : null,
      updatedAt:   new Date(),
    })
    .where(and(eq(guests.id, guestId), eq(guests.guestListId, gl.id)))
    .returning();

  const row = updated[0];
  if (!row) throw Object.assign(new Error('Guest not found'), { code: 'NOT_FOUND', status: 404 });
  await logActivity(weddingId, userId, checkedIn ? 'guest.checkIn' : 'guest.checkOut', 'guest', guestId);
  return mapGuestRich(row);
}

// ── updateRsvp (public — token-based; consolidated path) ─────────────────────

export async function updateRsvp(
  token: string,
  input: RsvpUpdateInput,
): Promise<GuestSummary> {
  // Try canonical rsvp_tokens path first
  let guestId: string | null = null;
  const tokRows = await db.select().from(rsvpTokens).where(eq(rsvpTokens.token, token)).limit(1);
  const tokRow = tokRows[0];
  if (tokRow) {
    if (tokRow.expiresAt.getTime() < Date.now()) {
      throw Object.assign(new Error('RSVP token expired'), { code: 'INVALID_TOKEN', status: 410 });
    }
    guestId = tokRow.guestId;
    await db.update(rsvpTokens).set({ usedAt: new Date() }).where(eq(rsvpTokens.id, tokRow.id));
  } else {
    // Legacy fallback: invitations.messageId
    const invRows = await db.select().from(invitations).where(eq(invitations.messageId, token)).limit(1);
    const inv = invRows[0];
    if (!inv) throw Object.assign(new Error('Invalid or expired RSVP token'), { code: 'INVALID_TOKEN', status: 404 });
    guestId = inv.guestId;
    await db.update(invitations).set({ rsvpAt: new Date() }).where(eq(invitations.id, inv.id));
  }

  const updateData: Partial<typeof guests.$inferInsert> = {
    rsvpStatus: input.rsvpStatus as GuestRow['rsvpStatus'],
    updatedAt:  new Date(),
  };
  if (input.mealPref !== undefined) {
    updateData.mealPreference = input.mealPref as GuestRow['mealPreference'];
  }

  const updated = await db.update(guests).set(updateData).where(eq(guests.id, guestId)).returning();
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
  vipCount:       number;
  checkedIn:      number;
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
      roomsAllocated: 0, vipCount: 0, checkedIn: 0,
    };
  }

  const rows = await db
    .select({
      rsvpStatus:     guests.rsvpStatus,
      mealPreference: guests.mealPreference,
      roomNumber:     guests.roomNumber,
      isVip:          guests.isVip,
      arrivedAt:      guests.arrivedAt,
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
    vipCount:       0,
    checkedIn:      0,
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
    if (r.isVip) stats.vipCount++;
    if (r.arrivedAt) stats.checkedIn++;
  }

  return stats;
}
