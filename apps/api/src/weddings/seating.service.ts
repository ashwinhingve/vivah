/**
 * Smart Shaadi — Seating planner
 *
 * Tables + assignments. Auto-assign greedily fills tables in capacity order
 * preferring guests of the same `side` and `relationship` to sit together.
 */

import { eq, and, asc, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  weddingSeatingTables,
  weddingSeatingAssignments,
  guests,
  guestLists,
} from '@smartshaadi/db';
import type { SeatingTable } from '@smartshaadi/types';
import type {
  CreateSeatingTableInput,
  UpdateSeatingTableInput,
  AssignSeatInput,
} from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

async function tableWithGuests(weddingId: string, tableId: string): Promise<SeatingTable> {
  const [t] = await db
    .select()
    .from(weddingSeatingTables)
    .where(and(eq(weddingSeatingTables.id, tableId), eq(weddingSeatingTables.weddingId, weddingId)))
    .limit(1);
  if (!t) throw appErr('Table not found', 'NOT_FOUND', 404);

  const rows = await db
    .select({
      guestId: weddingSeatingAssignments.guestId,
      seatNumber: weddingSeatingAssignments.seatNumber,
      guestName: guests.name,
    })
    .from(weddingSeatingAssignments)
    .innerJoin(guests, eq(guests.id, weddingSeatingAssignments.guestId))
    .where(eq(weddingSeatingAssignments.tableId, tableId))
    .orderBy(asc(weddingSeatingAssignments.seatNumber));

  return {
    id:         t.id,
    weddingId:  t.weddingId,
    ceremonyId: t.ceremonyId,
    name:       t.name,
    capacity:   t.capacity,
    shape:      t.shape,
    notes:      t.notes,
    posX:       t.posX,
    posY:       t.posY,
    assignedGuests: rows.map(r => ({ guestId: r.guestId, guestName: r.guestName, seatNumber: r.seatNumber })),
  };
}

export async function listTables(weddingId: string, userId: string, ceremonyId?: string | null): Promise<SeatingTable[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  const where = ceremonyId
    ? and(eq(weddingSeatingTables.weddingId, weddingId), eq(weddingSeatingTables.ceremonyId, ceremonyId))
    : eq(weddingSeatingTables.weddingId, weddingId);

  const rows = await db.select().from(weddingSeatingTables).where(where).orderBy(asc(weddingSeatingTables.name));
  const out: SeatingTable[] = [];
  for (const r of rows) out.push(await tableWithGuests(weddingId, r.id));
  return out;
}

export async function createTable(
  weddingId: string,
  userId: string,
  input: CreateSeatingTableInput,
): Promise<SeatingTable> {
  await requireRole(weddingId, userId, 'EDITOR');
  const [row] = await db
    .insert(weddingSeatingTables)
    .values({
      weddingId,
      ceremonyId: input.ceremonyId ?? null,
      name:       input.name,
      capacity:   input.capacity ?? 8,
      shape:      input.shape ?? 'ROUND',
      notes:      input.notes ?? null,
      posX:       input.posX ?? 0,
      posY:       input.posY ?? 0,
    })
    .returning();
  if (!row) throw appErr('Table create failed', 'TABLE_CREATE_FAILED', 500);

  await logActivity(weddingId, userId, 'seating.table.create', 'seatingTable', row.id, { name: row.name });
  return tableWithGuests(weddingId, row.id);
}

export async function updateTable(
  weddingId: string,
  userId: string,
  tableId: string,
  input: UpdateSeatingTableInput,
): Promise<SeatingTable> {
  await requireRole(weddingId, userId, 'EDITOR');
  const updates: Partial<typeof weddingSeatingTables.$inferInsert> = {};
  if (input.ceremonyId !== undefined) updates.ceremonyId = input.ceremonyId ?? null;
  if (input.name       !== undefined) updates.name       = input.name;
  if (input.capacity   !== undefined) updates.capacity   = input.capacity;
  if (input.shape      !== undefined) updates.shape      = input.shape;
  if (input.notes      !== undefined) updates.notes      = input.notes ?? null;
  if (input.posX       !== undefined) updates.posX       = input.posX;
  if (input.posY       !== undefined) updates.posY       = input.posY;

  const [row] = await db
    .update(weddingSeatingTables)
    .set(updates)
    .where(and(eq(weddingSeatingTables.id, tableId), eq(weddingSeatingTables.weddingId, weddingId)))
    .returning();
  if (!row) throw appErr('Table not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'seating.table.update', 'seatingTable', tableId);
  return tableWithGuests(weddingId, row.id);
}

export async function deleteTable(weddingId: string, userId: string, tableId: string): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  const deleted = await db
    .delete(weddingSeatingTables)
    .where(and(eq(weddingSeatingTables.id, tableId), eq(weddingSeatingTables.weddingId, weddingId)))
    .returning({ id: weddingSeatingTables.id });
  if (deleted.length === 0) throw appErr('Table not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'seating.table.delete', 'seatingTable', tableId);
}

export async function assignSeat(
  weddingId: string,
  userId: string,
  tableId: string,
  input: AssignSeatInput,
): Promise<SeatingTable> {
  await requireRole(weddingId, userId, 'EDITOR');

  const [t] = await db.select().from(weddingSeatingTables)
    .where(and(eq(weddingSeatingTables.id, tableId), eq(weddingSeatingTables.weddingId, weddingId)))
    .limit(1);
  if (!t) throw appErr('Table not found', 'NOT_FOUND', 404);

  // Verify guest belongs to this wedding
  const guestRows = await db
    .select({ id: guests.id })
    .from(guests)
    .innerJoin(guestLists, eq(guestLists.id, guests.guestListId))
    .where(and(eq(guests.id, input.guestId), eq(guestLists.weddingId, weddingId)))
    .limit(1);
  if (guestRows.length === 0) throw appErr('Guest not found in this wedding', 'NOT_FOUND', 404);

  // Capacity check (excluding existing assignment of this guest)
  const existing = await db.select().from(weddingSeatingAssignments)
    .where(eq(weddingSeatingAssignments.tableId, tableId));
  const isAlreadyHere = existing.some(e => e.guestId === input.guestId);
  if (!isAlreadyHere && existing.length >= t.capacity) {
    throw appErr('Table is at capacity', 'TABLE_FULL', 400);
  }

  // Remove guest from any other table first (guest is unique to one seat)
  await db.delete(weddingSeatingAssignments).where(eq(weddingSeatingAssignments.guestId, input.guestId));

  await db.insert(weddingSeatingAssignments).values({
    tableId,
    guestId:    input.guestId,
    seatNumber: input.seatNumber ?? null,
  });

  await logActivity(weddingId, userId, 'seating.assign', 'seat', tableId, { guestId: input.guestId });
  return tableWithGuests(weddingId, tableId);
}

export async function unassignSeat(
  weddingId: string,
  userId: string,
  tableId: string,
  guestId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  await db.delete(weddingSeatingAssignments)
    .where(and(eq(weddingSeatingAssignments.tableId, tableId), eq(weddingSeatingAssignments.guestId, guestId)));
  await logActivity(weddingId, userId, 'seating.unassign', 'seat', tableId, { guestId });
}

export async function autoAssign(
  weddingId: string,
  userId: string,
  ceremonyId: string | null,
): Promise<{ assigned: number; unassigned: number }> {
  await requireRole(weddingId, userId, 'EDITOR');

  // Pull existing tables for ceremony (or all if none specified)
  const tablesQ = ceremonyId
    ? db.select().from(weddingSeatingTables)
        .where(and(eq(weddingSeatingTables.weddingId, weddingId), eq(weddingSeatingTables.ceremonyId, ceremonyId)))
    : db.select().from(weddingSeatingTables).where(eq(weddingSeatingTables.weddingId, weddingId));
  const tables = await tablesQ;

  if (tables.length === 0) throw appErr('No tables to seat into', 'NO_TABLES', 400);

  // Confirmed guests of this wedding (rsvp YES)
  const guestRows = await db
    .select({
      id: guests.id, side: guests.side, relationship: guests.relationship,
      isVip: guests.isVip, plusOnes: guests.plusOnes, ageGroup: guests.ageGroup,
    })
    .from(guests)
    .innerJoin(guestLists, eq(guestLists.id, guests.guestListId))
    .where(and(eq(guestLists.weddingId, weddingId), eq(guests.rsvpStatus, 'YES')));

  // Wipe current assignments for these tables
  const tableIds = tables.map(t => t.id);
  if (tableIds.length > 0) {
    await db.delete(weddingSeatingAssignments).where(inArray(weddingSeatingAssignments.tableId, tableIds));
  }

  // Sort: VIPs first, then group by side+relationship
  const sorted = [...guestRows].sort((a, b) => {
    if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
    const sideCmp = (a.side ?? '').localeCompare(b.side ?? '');
    if (sideCmp !== 0) return sideCmp;
    return (a.relationship ?? '').localeCompare(b.relationship ?? '');
  });

  // Greedy fill — each guest counts as 1 + plusOnes seats
  const remaining = tables.map(t => ({ id: t.id, capacity: t.capacity, used: 0 }));
  let assigned = 0;
  let unassigned = 0;

  for (const g of sorted) {
    const seatsNeeded = 1 + (g.plusOnes ?? 0);
    const target = remaining.find(t => (t.capacity - t.used) >= seatsNeeded);
    if (!target) {
      unassigned++;
      continue;
    }
    await db.insert(weddingSeatingAssignments).values({
      tableId:    target.id,
      guestId:    g.id,
      seatNumber: target.used + 1,
    });
    target.used += seatsNeeded;
    assigned++;
  }

  await logActivity(weddingId, userId, 'seating.auto_assign', undefined, undefined, { assigned, unassigned });
  return { assigned, unassigned };
}
