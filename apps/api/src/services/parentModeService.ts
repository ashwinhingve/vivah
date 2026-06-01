/**
 * Smart Shaadi — Parent Mode Service
 *
 * Phase 3 item 10: a parent (or guardian) can manage a child's profile,
 * review matches, and draft actions (send interest, block, edit profile)
 * on the child's behalf. The child retains final say — every drafted
 * action is PENDING until the child approves or rejects it.
 *
 * Permission tiers (ascending):
 *   VIEW_ONLY     — read-only access to matches and profile
 *   EDIT_PROFILE  — can edit profile metadata (still gated by drafted actions)
 *   DRAFT_ACTIONS — can draft any action; child approves before execution
 *   FULL_PROXY    — same as DRAFT_ACTIONS today; reserved for future auto-execute
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  parentChildLinks,
  parentDraftedActions,
  user,
  profiles,
} from '@smartshaadi/db';
import { asProfileId } from '@smartshaadi/types';
import * as matchReqService from '../matchmaking/requests/service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type ParentRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SIBLING';
export type ParentPermission   = 'VIEW_ONLY' | 'EDIT_PROFILE' | 'DRAFT_ACTIONS' | 'FULL_PROXY';
export type ParentConsentState = 'PENDING' | 'APPROVED' | 'REVOKED';
export type ParentActionType   =
  | 'SEND_INTEREST' | 'ACCEPT_INTEREST' | 'REJECT_INTEREST'
  | 'SEND_MESSAGE'  | 'UPDATE_PROFILE'  | 'BLOCK_USER';
export type ParentActionStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED' | 'FAILED';

export interface ParentChildLink {
  id:                  string;
  parentUserId:        string;
  childUserId:         string;
  relationship:        ParentRelationship;
  permissions:         ParentPermission;
  childConsentStatus:  ParentConsentState;
  childConsentedAt:    Date | null;
  createdAt:           Date;
  revokedAt:           Date | null;
}

export interface DraftedAction {
  id:                string;
  parentUserId:      string;
  childUserId:       string;
  actionType:        ParentActionType;
  payload:           Record<string, unknown>;
  status:            ParentActionStatus;
  parentDraftedAt:   Date;
  childRespondedAt:  Date | null;
  executedAt:        Date | null;
  expiresAt:         Date | null;
  errorMessage:      string | null;
}

const ACTION_TTL_DAYS = 7;
const PERMISSIONS_THAT_DRAFT: ParentPermission[] = ['DRAFT_ACTIONS', 'FULL_PROXY'];

export interface ServiceError extends Error { code: string }
function svcError(code: string, message: string): ServiceError {
  const e = new Error(message) as ServiceError;
  e.code = code;
  return e;
}

// ── createParentLink ─────────────────────────────────────────────────────────

export async function createParentLink(input: {
  parentUserId: string;
  childUserId: string;
  relationship: ParentRelationship;
  requestedPermissions?: ParentPermission;
}): Promise<ParentChildLink> {
  if (input.parentUserId === input.childUserId) {
    throw svcError('SELF_LINK', 'Cannot link yourself as your own parent');
  }

  const usersExist = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`${user.id} IN (${input.parentUserId}, ${input.childUserId})`);
  if (usersExist.length < 2) {
    throw svcError('USER_NOT_FOUND', 'Both parent and child users must exist');
  }

  try {
    const [created] = await db
      .insert(parentChildLinks)
      .values({
        parentUserId: input.parentUserId,
        childUserId:  input.childUserId,
        relationship: input.relationship,
        permissions:  input.requestedPermissions ?? 'VIEW_ONLY',
      })
      .returning();

    if (!created) throw svcError('INSERT_FAILED', 'Failed to create parent link');
    return created as ParentChildLink;
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === '23505') {
      throw svcError('LINK_EXISTS', 'A link between these users already exists');
    }
    throw err;
  }
}

// ── approveLink ──────────────────────────────────────────────────────────────

export async function approveLink(linkId: string, childUserId: string): Promise<ParentChildLink> {
  const [link] = await db
    .select()
    .from(parentChildLinks)
    .where(eq(parentChildLinks.id, linkId))
    .limit(1);

  if (!link) throw svcError('NOT_FOUND', 'Link not found');
  if (link.childUserId !== childUserId) {
    throw svcError('FORBIDDEN', 'Only the child can approve this link');
  }
  if (link.childConsentStatus === 'APPROVED') return link as ParentChildLink;
  if (link.revokedAt) throw svcError('REVOKED', 'Link has been revoked');

  const [updated] = await db
    .update(parentChildLinks)
    .set({ childConsentStatus: 'APPROVED', childConsentedAt: new Date() })
    .where(eq(parentChildLinks.id, linkId))
    .returning();

  if (!updated) throw svcError('UPDATE_FAILED', 'Failed to approve link');
  return updated as ParentChildLink;
}

// ── revokeLink ───────────────────────────────────────────────────────────────

export async function revokeLink(linkId: string, byUserId: string): Promise<void> {
  const [link] = await db
    .select()
    .from(parentChildLinks)
    .where(eq(parentChildLinks.id, linkId))
    .limit(1);

  if (!link) throw svcError('NOT_FOUND', 'Link not found');
  if (link.parentUserId !== byUserId && link.childUserId !== byUserId) {
    throw svcError('FORBIDDEN', 'Only the parent or child can revoke this link');
  }
  if (link.revokedAt) return;

  await db
    .update(parentChildLinks)
    .set({ revokedAt: new Date(), childConsentStatus: 'REVOKED' })
    .where(eq(parentChildLinks.id, linkId));
}

// ── listMyLinks ──────────────────────────────────────────────────────────────

export async function listMyLinks(userId: string): Promise<{
  asParent: ParentChildLink[];
  asChild: ParentChildLink[];
}> {
  const asParent = await db
    .select()
    .from(parentChildLinks)
    .where(eq(parentChildLinks.parentUserId, userId))
    .orderBy(desc(parentChildLinks.createdAt));

  const asChild = await db
    .select()
    .from(parentChildLinks)
    .where(eq(parentChildLinks.childUserId, userId))
    .orderBy(desc(parentChildLinks.createdAt));

  return {
    asParent: asParent as ParentChildLink[],
    asChild:  asChild as ParentChildLink[],
  };
}

// ── listManagedChildren ──────────────────────────────────────────────────────

export async function listManagedChildren(parentUserId: string): Promise<ParentChildLink[]> {
  const rows = await db
    .select()
    .from(parentChildLinks)
    .where(and(
      eq(parentChildLinks.parentUserId, parentUserId),
      eq(parentChildLinks.childConsentStatus, 'APPROVED'),
      sql`${parentChildLinks.revokedAt} IS NULL`,
    ));
  return rows as ParentChildLink[];
}

// ── Authorization helper ─────────────────────────────────────────────────────

async function getActiveLink(parentUserId: string, childUserId: string): Promise<ParentChildLink | null> {
  const [row] = await db
    .select()
    .from(parentChildLinks)
    .where(and(
      eq(parentChildLinks.parentUserId, parentUserId),
      eq(parentChildLinks.childUserId, childUserId),
      eq(parentChildLinks.childConsentStatus, 'APPROVED'),
      sql`${parentChildLinks.revokedAt} IS NULL`,
    ))
    .limit(1);
  return (row as ParentChildLink) ?? null;
}

// ── draftAction ──────────────────────────────────────────────────────────────

export async function draftAction(input: {
  parentUserId: string;
  childUserId: string;
  actionType: ParentActionType;
  payload: Record<string, unknown>;
}): Promise<DraftedAction> {
  const link = await getActiveLink(input.parentUserId, input.childUserId);
  if (!link) throw svcError('NO_LINK', 'No active parent-child link found');

  if (!PERMISSIONS_THAT_DRAFT.includes(link.permissions)) {
    throw svcError('INSUFFICIENT_PERMISSION', `Permission tier '${link.permissions}' cannot draft actions`);
  }

  const expiresAt = new Date(Date.now() + ACTION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [created] = await db
    .insert(parentDraftedActions)
    .values({
      parentUserId: input.parentUserId,
      childUserId:  input.childUserId,
      actionType:   input.actionType,
      payload:      input.payload,
      expiresAt,
    })
    .returning();

  if (!created) throw svcError('INSERT_FAILED', 'Failed to create drafted action');
  return created as DraftedAction;
}

// ── approveAction ────────────────────────────────────────────────────────────

export async function approveAction(actionId: string, childUserId: string): Promise<DraftedAction> {
  const [action] = await db
    .select()
    .from(parentDraftedActions)
    .where(eq(parentDraftedActions.id, actionId))
    .limit(1);

  if (!action) throw svcError('NOT_FOUND', 'Action not found');
  if (action.childUserId !== childUserId) {
    throw svcError('FORBIDDEN', 'Only the child can approve this action');
  }
  if (action.status !== 'PENDING') {
    throw svcError('INVALID_STATUS', `Cannot approve action with status ${action.status}`);
  }
  if (action.expiresAt && action.expiresAt.getTime() < Date.now()) {
    await db
      .update(parentDraftedActions)
      .set({ status: 'EXPIRED' })
      .where(eq(parentDraftedActions.id, actionId));
    throw svcError('EXPIRED', 'Action has expired');
  }

  await db
    .update(parentDraftedActions)
    .set({ status: 'APPROVED', childRespondedAt: new Date() })
    .where(eq(parentDraftedActions.id, actionId));

  try {
    await executeAction(action as DraftedAction);
    const [executed] = await db
      .update(parentDraftedActions)
      .set({ status: 'EXECUTED', executedAt: new Date() })
      .where(eq(parentDraftedActions.id, actionId))
      .returning();
    return executed as DraftedAction;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown execution failure';
    const [failed] = await db
      .update(parentDraftedActions)
      .set({ status: 'FAILED', errorMessage: msg })
      .where(eq(parentDraftedActions.id, actionId))
      .returning();
    return failed as DraftedAction;
  }
}

// ── rejectAction ─────────────────────────────────────────────────────────────

export async function rejectAction(actionId: string, childUserId: string): Promise<DraftedAction> {
  const [action] = await db
    .select()
    .from(parentDraftedActions)
    .where(eq(parentDraftedActions.id, actionId))
    .limit(1);

  if (!action) throw svcError('NOT_FOUND', 'Action not found');
  if (action.childUserId !== childUserId) {
    throw svcError('FORBIDDEN', 'Only the child can reject this action');
  }
  if (action.status !== 'PENDING') {
    throw svcError('INVALID_STATUS', `Cannot reject action with status ${action.status}`);
  }

  const [updated] = await db
    .update(parentDraftedActions)
    .set({ status: 'REJECTED', childRespondedAt: new Date() })
    .where(eq(parentDraftedActions.id, actionId))
    .returning();

  return updated as DraftedAction;
}

// ── listPendingActions (child inbox) ─────────────────────────────────────────

export async function listPendingActions(childUserId: string): Promise<DraftedAction[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(parentDraftedActions)
    .where(and(
      eq(parentDraftedActions.childUserId, childUserId),
      eq(parentDraftedActions.status, 'PENDING'),
      sql`(${parentDraftedActions.expiresAt} IS NULL OR ${parentDraftedActions.expiresAt} > ${now})`,
    ))
    .orderBy(desc(parentDraftedActions.parentDraftedAt));

  return rows as DraftedAction[];
}

// ── listDraftedActions (parent's history) ────────────────────────────────────

export async function listDraftedActions(parentUserId: string): Promise<DraftedAction[]> {
  const rows = await db
    .select()
    .from(parentDraftedActions)
    .where(eq(parentDraftedActions.parentUserId, parentUserId))
    .orderBy(desc(parentDraftedActions.parentDraftedAt))
    .limit(50);
  return rows as DraftedAction[];
}

// ── Execution dispatcher ─────────────────────────────────────────────────────

/**
 * Thin wrapper — delegates to existing services. Never duplicate business logic.
 * Currently implements SEND_INTEREST. Other action types are stubbed with
 * structured NOT_IMPLEMENTED errors so the child still sees that approval
 * succeeded but execution is pending platform support.
 */
async function executeAction(action: DraftedAction): Promise<void> {
  if (action.actionType === 'SEND_INTEREST') {
    const payload = action.payload as { targetProfileId?: string; message?: string };
    if (!payload.targetProfileId) {
      throw svcError('INVALID_PAYLOAD', 'SEND_INTEREST requires targetProfileId');
    }

    const [childProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, action.childUserId))
      .limit(1);
    if (!childProfile) throw svcError('NO_PROFILE', 'Child has no profile');

    await matchReqService.sendRequest(asProfileId(childProfile.id), asProfileId(payload.targetProfileId), {
      message: payload.message,
    });
    return;
  }

  throw svcError('NOT_IMPLEMENTED', `Action type ${action.actionType} execution is not yet supported`);
}
