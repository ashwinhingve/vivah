/**
 * Smart Shaadi — Wedding access control
 *
 * Resolves a userId against a wedding to determine access level:
 *   OWNER  — wedding belongs to the user's profile, OR explicit OWNER member
 *   EDITOR — accepted weddingMembers row with role EDITOR
 *   VIEWER — accepted weddingMembers row with role VIEWER
 *   null   — no access
 *
 * Throws an error tagged with code/status compatible with the existing
 * router error handler.
 */

import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { weddings, profiles, weddingMembers, weddingCoordinatorAssignments, user } from '@smartshaadi/db';

export type WeddingRole = 'OWNER' | 'EDITOR' | 'VIEWER' | 'COORDINATOR';

interface AppError extends Error {
  code:   string;
  status: number;
}

function appErr(message: string, code: string, status: number): AppError {
  return Object.assign(new Error(message), { code, status });
}

export async function getWeddingRole(
  weddingId: string,
  userId: string,
): Promise<WeddingRole | null> {
  const [wedding] = await db
    .select({ id: weddings.id, profileId: weddings.profileId })
    .from(weddings)
    .where(eq(weddings.id, weddingId))
    .limit(1);

  if (!wedding) return null;

  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (profile && wedding.profileId === profile.id) return 'OWNER';

  const [member] = await db
    .select()
    .from(weddingMembers)
    .where(and(eq(weddingMembers.weddingId, weddingId), eq(weddingMembers.userId, userId)))
    .limit(1);

  if (member && member.acceptedAt) {
    const role = member.role.toUpperCase();
    if (role === 'OWNER' || role === 'EDITOR' || role === 'VIEWER') return role;
    return 'VIEWER';
  }

  // System-level EVENT_COORDINATOR with active assignment row
  const [u] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (u?.role === 'EVENT_COORDINATOR' || u?.role === 'ADMIN') {
    const [assignment] = await db
      .select({ id: weddingCoordinatorAssignments.id, scope: weddingCoordinatorAssignments.scope })
      .from(weddingCoordinatorAssignments)
      .where(and(
        eq(weddingCoordinatorAssignments.weddingId, weddingId),
        eq(weddingCoordinatorAssignments.coordinatorUserId, userId),
        isNull(weddingCoordinatorAssignments.revokedAt),
      ))
      .limit(1);
    if (assignment) return 'COORDINATOR';
    if (u.role === 'ADMIN') return 'COORDINATOR';
  }

  return null;
}

export async function requireRole(
  weddingId: string,
  userId: string,
  required: WeddingRole | 'ANY',
): Promise<WeddingRole> {
  const role = await getWeddingRole(weddingId, userId);
  if (!role) throw appErr('Wedding not found', 'NOT_FOUND', 404);

  if (required === 'ANY') return role;

  // COORDINATOR has read+write equivalent to EDITOR for most operations.
  // OWNER-only ops (delete wedding, transfer ownership) check explicitly.
  const order: Record<WeddingRole, number> = { OWNER: 4, COORDINATOR: 3, EDITOR: 2, VIEWER: 1 };
  if (order[role] < order[required]) {
    throw appErr('Forbidden', 'FORBIDDEN', 403);
  }
  return role;
}
