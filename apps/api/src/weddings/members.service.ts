/**
 * Smart Shaadi — Wedding members + invites (collaborators)
 *
 * Owner can invite by email. Invitee accepts via token, which creates an
 * active weddingMembers row.
 */

import { randomUUID, randomBytes } from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  weddingMembers,
  weddingMemberInvites,
  user as userTable,
} from '@smartshaadi/db';
import type { WeddingMember, WeddingMemberInvite } from '@smartshaadi/types';
import type {
  InviteMemberInput,
  UpdateMemberRoleInput,
} from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

const INVITE_TTL_DAYS = 7;

void randomUUID;

export async function listMembers(weddingId: string, userId: string): Promise<WeddingMember[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  const rows = await db
    .select({
      id:         weddingMembers.id,
      weddingId:  weddingMembers.weddingId,
      userId:     weddingMembers.userId,
      role:       weddingMembers.role,
      invitedAt:  weddingMembers.invitedAt,
      acceptedAt: weddingMembers.acceptedAt,
      email:      userTable.email,
      name:       userTable.name,
    })
    .from(weddingMembers)
    .leftJoin(userTable, eq(userTable.id, weddingMembers.userId))
    .where(eq(weddingMembers.weddingId, weddingId));

  return rows.map((r): WeddingMember => ({
    id:         r.id,
    weddingId:  r.weddingId,
    userId:     r.userId,
    email:      r.email ?? null,
    name:       r.name ?? null,
    role:       (r.role.toUpperCase() as WeddingMember['role']),
    invitedAt:  r.invitedAt.toISOString(),
    acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
  }));
}

export async function listInvites(weddingId: string, userId: string): Promise<WeddingMemberInvite[]> {
  await requireRole(weddingId, userId, 'OWNER');
  const rows = await db
    .select()
    .from(weddingMemberInvites)
    .where(eq(weddingMemberInvites.weddingId, weddingId));
  return rows.map((r): WeddingMemberInvite => ({
    id:         r.id,
    email:      r.email,
    role:       r.role.toUpperCase() as WeddingMemberInvite['role'],
    expiresAt:  r.expiresAt.toISOString(),
    acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
    createdAt:  r.createdAt.toISOString(),
  }));
}

export async function inviteMember(
  weddingId: string,
  userId: string,
  input: InviteMemberInput,
): Promise<{ inviteId: string; token: string; expiresAt: string }> {
  await requireRole(weddingId, userId, 'OWNER');

  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(weddingMemberInvites)
    .values({
      weddingId,
      inviterId: userId,
      email:     input.email.toLowerCase(),
      role:      input.role,
      token,
      expiresAt,
    })
    .returning();
  if (!row) throw appErr('Invite create failed', 'INVITE_CREATE_FAILED', 500);

  await logActivity(weddingId, userId, 'member.invite', 'invite', row.id, { email: input.email, role: input.role });
  return { inviteId: row.id, token: row.token, expiresAt: row.expiresAt.toISOString() };
}

export async function acceptInvite(
  userId: string,
  userEmail: string,
  token: string,
): Promise<{ weddingId: string; role: WeddingMember['role'] }> {
  const [invite] = await db
    .select()
    .from(weddingMemberInvites)
    .where(and(eq(weddingMemberInvites.token, token), gt(weddingMemberInvites.expiresAt, new Date())))
    .limit(1);
  if (!invite) throw appErr('Invalid or expired invite', 'INVALID_INVITE', 404);
  if (invite.acceptedAt) throw appErr('Invite already accepted', 'INVITE_USED', 400);

  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw appErr('Invite was issued to a different email', 'EMAIL_MISMATCH', 403);
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(weddingMembers)
      .values({
        weddingId:  invite.weddingId,
        userId,
        role:       invite.role,
        acceptedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [weddingMembers.weddingId, weddingMembers.userId],
        set:    { role: invite.role, acceptedAt: new Date() },
      });

    await tx.update(weddingMemberInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(weddingMemberInvites.id, invite.id));
  });

  await logActivity(invite.weddingId, userId, 'member.accept', 'member', userId);
  return {
    weddingId: invite.weddingId,
    role:      invite.role.toUpperCase() as WeddingMember['role'],
  };
}

export async function updateMemberRole(
  weddingId: string,
  userId: string,
  memberId: string,
  input: UpdateMemberRoleInput,
): Promise<void> {
  await requireRole(weddingId, userId, 'OWNER');
  const updated = await db
    .update(weddingMembers)
    .set({ role: input.role })
    .where(and(eq(weddingMembers.id, memberId), eq(weddingMembers.weddingId, weddingId)))
    .returning({ id: weddingMembers.id });
  if (updated.length === 0) throw appErr('Member not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'member.role.update', 'member', memberId, { role: input.role });
}

export async function removeMember(
  weddingId: string,
  userId: string,
  memberId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'OWNER');
  const deleted = await db
    .delete(weddingMembers)
    .where(and(eq(weddingMembers.id, memberId), eq(weddingMembers.weddingId, weddingId)))
    .returning({ id: weddingMembers.id });
  if (deleted.length === 0) throw appErr('Member not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'member.remove', 'member', memberId);
}
