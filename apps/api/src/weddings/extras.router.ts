/**
 * Smart Shaadi — Wedding extras router
 *
 * Mounts the world-class wedding planning endpoints under /weddings/:id and
 * the public-access endpoints (RSVP token, public site) at top level.
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  CreateExpenseSchema, UpdateExpenseSchema, RecordPaymentSchema,
  CreateTimelineEventSchema, UpdateTimelineEventSchema, ReorderTimelineSchema,
  CreateSeatingTableSchema, UpdateSeatingTableSchema, AssignSeatSchema,
  AddDocumentSchema, AddMoodBoardItemSchema, UpdateMoodBoardItemSchema,
  InviteMemberSchema, AcceptInviteSchema, UpdateMemberRoleSchema,
  AssignVendorSchema, UpdateVendorAssignmentSchema,
  UpsertWebsiteSchema,
  CreateRegistryItemSchema, UpdateRegistryItemSchema, ClaimRegistryItemSchema,
  CreateTaskCommentSchema, AddTaskAttachmentSchema,
  PublicRsvpUpdateSchema,
} from '@smartshaadi/schemas';

import * as expenses from './expenses.service.js';
import * as timeline from './timeline.service.js';
import * as seating  from './seating.service.js';
import * as documents from './documents.service.js';
import * as moodboard from './moodboard.service.js';
import * as members  from './members.service.js';
import * as vendorAssign from './vendorAssignments.service.js';
import * as website from './website.service.js';
import * as registry from './registry.service.js';
import * as comments from './taskComments.service.js';
import * as activity from './activity.service.js';
import * as publicRsvp from './publicRsvp.service.js';

interface AppError extends Error { code?: string; status?: number; }

function handle(res: Response, e: unknown, fallbackCode: string): void {
  const ae = e as AppError;
  const code = ae.code ?? fallbackCode;
  const status = ae.status ?? 500;
  const msg = ae instanceof Error ? ae.message : 'Unknown error';
  err(res, code, msg, status);
}

export const weddingExtrasRouter = Router({ mergeParams: true });

// ─── EXPENSES ────────────────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/expenses', authenticate, async (req, res) => {
  try { ok(res, { expenses: await expenses.listExpenses(req.params['id']!, req.user!.id) }); }
  catch (e) { handle(res, e, 'EXPENSE_LIST_ERROR'); }
});

weddingExtrasRouter.get('/:id/expenses/summary', authenticate, async (req, res) => {
  try { ok(res, await expenses.getExpenseSummary(req.params['id']!, req.user!.id)); }
  catch (e) { handle(res, e, 'EXPENSE_SUMMARY_ERROR'); }
});

weddingExtrasRouter.get('/:id/expenses/by-ceremony', authenticate, async (req, res) => {
  try { ok(res, await expenses.getCeremonyBudgetRollup(req.params['id']!, req.user!.id)); }
  catch (e) { handle(res, e, 'CEREMONY_BUDGET_ERROR'); }
});

weddingExtrasRouter.post('/:id/expenses', authenticate, async (req, res) => {
  const parsed = CreateExpenseSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await expenses.createExpense(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'EXPENSE_CREATE_ERROR'); }
});

weddingExtrasRouter.put('/:id/expenses/:expId', authenticate, async (req, res) => {
  const parsed = UpdateExpenseSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await expenses.updateExpense(req.params['id']!, req.user!.id, req.params['expId']!, parsed.data)); }
  catch (e) { handle(res, e, 'EXPENSE_UPDATE_ERROR'); }
});

weddingExtrasRouter.delete('/:id/expenses/:expId', authenticate, async (req, res) => {
  try { await expenses.deleteExpense(req.params['id']!, req.user!.id, req.params['expId']!); ok(res, { deleted: true }); }
  catch (e) { handle(res, e, 'EXPENSE_DELETE_ERROR'); }
});

weddingExtrasRouter.post('/:id/expenses/:expId/payments', authenticate, async (req, res) => {
  const parsed = RecordPaymentSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await expenses.recordPayment(req.params['id']!, req.user!.id, req.params['expId']!, parsed.data)); }
  catch (e) { handle(res, e, 'PAYMENT_RECORD_ERROR'); }
});

// ─── TIMELINE ────────────────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/timeline', authenticate, async (req, res) => {
  try { ok(res, { events: await timeline.listTimeline(req.params['id']!, req.user!.id) }); }
  catch (e) { handle(res, e, 'TIMELINE_LIST_ERROR'); }
});

weddingExtrasRouter.post('/:id/timeline', authenticate, async (req, res) => {
  const parsed = CreateTimelineEventSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await timeline.createEvent(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'TIMELINE_CREATE_ERROR'); }
});

weddingExtrasRouter.put('/:id/timeline/:eventId', authenticate, async (req, res) => {
  const parsed = UpdateTimelineEventSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await timeline.updateEvent(req.params['id']!, req.user!.id, req.params['eventId']!, parsed.data)); }
  catch (e) { handle(res, e, 'TIMELINE_UPDATE_ERROR'); }
});

weddingExtrasRouter.delete('/:id/timeline/:eventId', authenticate, async (req, res) => {
  try { await timeline.deleteEvent(req.params['id']!, req.user!.id, req.params['eventId']!); ok(res, { deleted: true }); }
  catch (e) { handle(res, e, 'TIMELINE_DELETE_ERROR'); }
});

weddingExtrasRouter.put('/:id/timeline/reorder', authenticate, async (req, res) => {
  const parsed = ReorderTimelineSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { await timeline.reorderTimeline(req.params['id']!, req.user!.id, parsed.data); ok(res, { ok: true }); }
  catch (e) { handle(res, e, 'TIMELINE_REORDER_ERROR'); }
});

weddingExtrasRouter.post('/:id/timeline/auto-generate', authenticate, async (req, res) => {
  try { ok(res, await timeline.autoGenerateFromCeremonies(req.params['id']!, req.user!.id)); }
  catch (e) { handle(res, e, 'TIMELINE_AUTO_GEN_ERROR'); }
});

// ─── SEATING ─────────────────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/seating/tables', authenticate, async (req, res) => {
  const ceremonyId = typeof req.query['ceremonyId'] === 'string' ? req.query['ceremonyId'] : undefined;
  try { ok(res, { tables: await seating.listTables(req.params['id']!, req.user!.id, ceremonyId ?? null) }); }
  catch (e) { handle(res, e, 'SEATING_LIST_ERROR'); }
});

weddingExtrasRouter.post('/:id/seating/tables', authenticate, async (req, res) => {
  const parsed = CreateSeatingTableSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await seating.createTable(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'SEATING_CREATE_ERROR'); }
});

weddingExtrasRouter.put('/:id/seating/tables/:tableId', authenticate, async (req, res) => {
  const parsed = UpdateSeatingTableSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await seating.updateTable(req.params['id']!, req.user!.id, req.params['tableId']!, parsed.data)); }
  catch (e) { handle(res, e, 'SEATING_UPDATE_ERROR'); }
});

weddingExtrasRouter.delete('/:id/seating/tables/:tableId', authenticate, async (req, res) => {
  try { await seating.deleteTable(req.params['id']!, req.user!.id, req.params['tableId']!); ok(res, { deleted: true }); }
  catch (e) { handle(res, e, 'SEATING_DELETE_ERROR'); }
});

weddingExtrasRouter.post('/:id/seating/tables/:tableId/assign', authenticate, async (req, res) => {
  const parsed = AssignSeatSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await seating.assignSeat(req.params['id']!, req.user!.id, req.params['tableId']!, parsed.data)); }
  catch (e) { handle(res, e, 'SEATING_ASSIGN_ERROR'); }
});

weddingExtrasRouter.delete('/:id/seating/tables/:tableId/assign/:guestId', authenticate, async (req, res) => {
  try { await seating.unassignSeat(req.params['id']!, req.user!.id, req.params['tableId']!, req.params['guestId']!); ok(res, { ok: true }); }
  catch (e) { handle(res, e, 'SEATING_UNASSIGN_ERROR'); }
});

weddingExtrasRouter.post('/:id/seating/auto-assign', authenticate, async (req, res) => {
  const ceremonyId = typeof req.body?.ceremonyId === 'string' ? req.body.ceremonyId : null;
  try { ok(res, await seating.autoAssign(req.params['id']!, req.user!.id, ceremonyId)); }
  catch (e) { handle(res, e, 'SEATING_AUTO_ASSIGN_ERROR'); }
});

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/documents', authenticate, async (req, res) => {
  try { ok(res, { documents: await documents.listDocuments(req.params['id']!, req.user!.id) }); }
  catch (e) { handle(res, e, 'DOC_LIST_ERROR'); }
});

weddingExtrasRouter.post('/:id/documents', authenticate, async (req, res) => {
  const parsed = AddDocumentSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await documents.addDocument(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'DOC_ADD_ERROR'); }
});

weddingExtrasRouter.delete('/:id/documents/:docId', authenticate, async (req, res) => {
  try { await documents.deleteDocument(req.params['id']!, req.user!.id, req.params['docId']!); ok(res, { deleted: true }); }
  catch (e) { handle(res, e, 'DOC_DELETE_ERROR'); }
});

// ─── MOOD BOARD ──────────────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/moodboard', authenticate, async (req, res) => {
  const cat = typeof req.query['category'] === 'string' ? req.query['category'] : undefined;
  try { ok(res, { items: await moodboard.listItems(req.params['id']!, req.user!.id, cat) }); }
  catch (e) { handle(res, e, 'MOODBOARD_LIST_ERROR'); }
});

weddingExtrasRouter.post('/:id/moodboard', authenticate, async (req, res) => {
  const parsed = AddMoodBoardItemSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await moodboard.addItem(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'MOODBOARD_ADD_ERROR'); }
});

weddingExtrasRouter.put('/:id/moodboard/:itemId', authenticate, async (req, res) => {
  const parsed = UpdateMoodBoardItemSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await moodboard.updateItem(req.params['id']!, req.user!.id, req.params['itemId']!, parsed.data)); }
  catch (e) { handle(res, e, 'MOODBOARD_UPDATE_ERROR'); }
});

weddingExtrasRouter.delete('/:id/moodboard/:itemId', authenticate, async (req, res) => {
  try { await moodboard.deleteItem(req.params['id']!, req.user!.id, req.params['itemId']!); ok(res, { deleted: true }); }
  catch (e) { handle(res, e, 'MOODBOARD_DELETE_ERROR'); }
});

// ─── MEMBERS / INVITES ───────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/members', authenticate, async (req, res) => {
  try { ok(res, { members: await members.listMembers(req.params['id']!, req.user!.id) }); }
  catch (e) { handle(res, e, 'MEMBER_LIST_ERROR'); }
});

weddingExtrasRouter.get('/:id/members/invites', authenticate, async (req, res) => {
  try { ok(res, { invites: await members.listInvites(req.params['id']!, req.user!.id) }); }
  catch (e) { handle(res, e, 'INVITE_LIST_ERROR'); }
});

weddingExtrasRouter.post('/:id/members/invites', authenticate, async (req, res) => {
  const parsed = InviteMemberSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await members.inviteMember(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'INVITE_CREATE_ERROR'); }
});

weddingExtrasRouter.put('/:id/members/:memberId', authenticate, async (req, res) => {
  const parsed = UpdateMemberRoleSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { await members.updateMemberRole(req.params['id']!, req.user!.id, req.params['memberId']!, parsed.data); ok(res, { ok: true }); }
  catch (e) { handle(res, e, 'MEMBER_UPDATE_ERROR'); }
});

weddingExtrasRouter.delete('/:id/members/:memberId', authenticate, async (req, res) => {
  try { await members.removeMember(req.params['id']!, req.user!.id, req.params['memberId']!); ok(res, { ok: true }); }
  catch (e) { handle(res, e, 'MEMBER_REMOVE_ERROR'); }
});

// ─── VENDOR ASSIGNMENTS ──────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/vendors', authenticate, async (req, res) => {
  try { ok(res, { assignments: await vendorAssign.listAssignments(req.params['id']!, req.user!.id) }); }
  catch (e) { handle(res, e, 'VENDOR_LIST_ERROR'); }
});

weddingExtrasRouter.post('/:id/vendors', authenticate, async (req, res) => {
  const parsed = AssignVendorSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await vendorAssign.assignVendor(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'VENDOR_ASSIGN_ERROR'); }
});

weddingExtrasRouter.put('/:id/vendors/:assignmentId', authenticate, async (req, res) => {
  const parsed = UpdateVendorAssignmentSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { await vendorAssign.updateAssignment(req.params['id']!, req.user!.id, req.params['assignmentId']!, parsed.data); ok(res, { ok: true }); }
  catch (e) { handle(res, e, 'VENDOR_UPDATE_ERROR'); }
});

weddingExtrasRouter.delete('/:id/vendors/:assignmentId', authenticate, async (req, res) => {
  try { await vendorAssign.removeAssignment(req.params['id']!, req.user!.id, req.params['assignmentId']!); ok(res, { ok: true }); }
  catch (e) { handle(res, e, 'VENDOR_REMOVE_ERROR'); }
});

// ─── WEBSITE ─────────────────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/website', authenticate, async (req, res) => {
  try { ok(res, await website.getWebsite(req.params['id']!, req.user!.id) ?? null); }
  catch (e) { handle(res, e, 'WEBSITE_GET_ERROR'); }
});

weddingExtrasRouter.put('/:id/website', authenticate, async (req, res) => {
  const parsed = UpsertWebsiteSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await website.upsertWebsite(req.params['id']!, req.user!.id, parsed.data)); }
  catch (e) { handle(res, e, 'WEBSITE_SAVE_ERROR'); }
});

// ─── REGISTRY ────────────────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/registry', authenticate, async (req, res) => {
  try { ok(res, { items: await registry.listItems(req.params['id']!, req.user!.id) }); }
  catch (e) { handle(res, e, 'REGISTRY_LIST_ERROR'); }
});

weddingExtrasRouter.post('/:id/registry', authenticate, async (req, res) => {
  const parsed = CreateRegistryItemSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await registry.createItem(req.params['id']!, req.user!.id, parsed.data), 201); }
  catch (e) { handle(res, e, 'REGISTRY_CREATE_ERROR'); }
});

weddingExtrasRouter.put('/:id/registry/:itemId', authenticate, async (req, res) => {
  const parsed = UpdateRegistryItemSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await registry.updateItem(req.params['id']!, req.user!.id, req.params['itemId']!, parsed.data)); }
  catch (e) { handle(res, e, 'REGISTRY_UPDATE_ERROR'); }
});

weddingExtrasRouter.delete('/:id/registry/:itemId', authenticate, async (req, res) => {
  try { await registry.deleteItem(req.params['id']!, req.user!.id, req.params['itemId']!); ok(res, { deleted: true }); }
  catch (e) { handle(res, e, 'REGISTRY_DELETE_ERROR'); }
});

// ─── TASK COMMENTS / ATTACHMENTS ─────────────────────────────────────────────

weddingExtrasRouter.get('/:id/tasks/:taskId/comments', authenticate, async (req, res) => {
  try { ok(res, { comments: await comments.listComments(req.params['id']!, req.user!.id, req.params['taskId']!) }); }
  catch (e) { handle(res, e, 'COMMENT_LIST_ERROR'); }
});

weddingExtrasRouter.post('/:id/tasks/:taskId/comments', authenticate, async (req, res) => {
  const parsed = CreateTaskCommentSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await comments.createComment(req.params['id']!, req.user!.id, req.params['taskId']!, parsed.data), 201); }
  catch (e) { handle(res, e, 'COMMENT_CREATE_ERROR'); }
});

weddingExtrasRouter.delete('/:id/tasks/:taskId/comments/:commentId', authenticate, async (req, res) => {
  try { await comments.deleteComment(req.params['id']!, req.user!.id, req.params['taskId']!, req.params['commentId']!); ok(res, { ok: true }); }
  catch (e) { handle(res, e, 'COMMENT_DELETE_ERROR'); }
});

weddingExtrasRouter.get('/:id/tasks/:taskId/attachments', authenticate, async (req, res) => {
  try { ok(res, { attachments: await comments.listAttachments(req.params['id']!, req.user!.id, req.params['taskId']!) }); }
  catch (e) { handle(res, e, 'ATTACH_LIST_ERROR'); }
});

weddingExtrasRouter.post('/:id/tasks/:taskId/attachments', authenticate, async (req, res) => {
  const parsed = AddTaskAttachmentSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await comments.addAttachment(req.params['id']!, req.user!.id, req.params['taskId']!, parsed.data), 201); }
  catch (e) { handle(res, e, 'ATTACH_ADD_ERROR'); }
});

weddingExtrasRouter.delete('/:id/tasks/:taskId/attachments/:attachmentId', authenticate, async (req, res) => {
  try { await comments.deleteAttachment(req.params['id']!, req.user!.id, req.params['taskId']!, req.params['attachmentId']!); ok(res, { ok: true }); }
  catch (e) { handle(res, e, 'ATTACH_DELETE_ERROR'); }
});

// ─── ACTIVITY LOG ────────────────────────────────────────────────────────────

weddingExtrasRouter.get('/:id/activity', authenticate, async (req, res) => {
  const limit = Number(req.query['limit'] ?? 50);
  try { ok(res, { entries: await activity.getActivity(req.params['id']!, req.user!.id, isFinite(limit) ? limit : 50) }); }
  catch (e) { handle(res, e, 'ACTIVITY_LIST_ERROR'); }
});

// ─── PUBLIC RSVP TOKEN issue ─────────────────────────────────────────────────

weddingExtrasRouter.post('/:id/guests/:guestId/rsvp-token', authenticate, async (req, res) => {
  try { ok(res, await publicRsvp.generateTokenForGuest(req.params['id']!, req.user!.id, req.params['guestId']!), 201); }
  catch (e) { handle(res, e, 'RSVP_TOKEN_ERROR'); }
});

// ─── PUBLIC ROUTES (no auth) — separate router exported below ────────────────

export const publicRsvpRouter = Router();

publicRsvpRouter.get('/rsvp/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const view = await publicRsvp.getRsvpView(req.params['token']!);
    if (!view) { err(res, 'NOT_FOUND', 'Invalid or expired link', 404); return; }
    ok(res, view);
  } catch (e) { handle(res, e, 'RSVP_GET_ERROR'); }
});

publicRsvpRouter.post('/rsvp/:token', async (req: Request, res: Response): Promise<void> => {
  const parsed = PublicRsvpUpdateSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await publicRsvp.submitRsvp(req.params['token']!, parsed.data)); }
  catch (e) { handle(res, e, 'RSVP_SUBMIT_ERROR'); }
});

publicRsvpRouter.get('/wedding-sites/:slug', async (req: Request, res: Response): Promise<void> => {
  const password = typeof req.query['password'] === 'string' ? req.query['password'] : undefined;
  try {
    const view = await website.getPublicWebsite(req.params['slug']!, password);
    if (!view) { err(res, 'NOT_FOUND', 'Site not found', 404); return; }
    ok(res, view);
  } catch (e) { handle(res, e, 'PUBLIC_SITE_ERROR'); }
});

publicRsvpRouter.post('/wedding-sites/registry/:itemId/claim', async (req: Request, res: Response): Promise<void> => {
  const parsed = ClaimRegistryItemSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  try { ok(res, await registry.claimItemPublic(req.params['itemId']!, parsed.data)); }
  catch (e) { handle(res, e, 'REGISTRY_CLAIM_ERROR'); }
});

// Member invite-accept — authenticated user accepts an invitation
weddingExtrasRouter.post('/invites/accept', authenticate, async (req, res) => {
  const parsed = AcceptInviteSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid', 400); return; }
  const email = req.user!.email;
  if (!email) { err(res, 'EMAIL_MISSING', 'User has no email on file', 400); return; }
  try {
    const result = await members.acceptInvite(req.user!.id, email, parsed.data.token);
    ok(res, result);
  } catch (e) { handle(res, e, 'INVITE_ACCEPT_ERROR'); }
});
