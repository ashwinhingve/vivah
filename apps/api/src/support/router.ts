/**
 * Smart Shaadi — Support Console router (mounted at /api/v1/support)
 *
 * Staff surface (SUPPORT + ADMIN): queue, ticket detail, assign/prioritise/
 * resolve, internal notes, and chat-abuse report triage.
 * End-user surface (any authenticated user): raise a ticket + reply on their
 * own ticket.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { db } from '../lib/db.js';
import { supportTickets } from '@smartshaadi/db';
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  addMessage,
  getStats,
  listChatReports,
  actOnChatReport,
  listStaff,
  type SupportError,
  type TicketStatus,
  type TicketPriority,
} from './service.js';

export const supportRouter = Router();

const STAFF = authorize(['SUPPORT', 'ADMIN']);

function handle(res: Response, e: unknown, fallback: string): void {
  const se = e as Partial<SupportError>;
  if (se && typeof se.code === 'string' && typeof se.status === 'number') {
    err(res, se.code, se.message ?? fallback, se.status);
    return;
  }
  console.error('[support]', e);
  err(res, 'INTERNAL', fallback, 500);
}

const STATUS = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
const PRIORITY = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const SOURCE = ['USER', 'CHAT_REPORT', 'DISPUTE', 'KYC_APPEAL', 'SYSTEM'] as const;
const CATEGORY = ['ACCOUNT', 'PAYMENT', 'BOOKING', 'MATCH_ABUSE', 'KYC', 'VENDOR', 'TECHNICAL', 'OTHER'] as const;

// ── GET /support/queue — staff ticket queue ──────────────────────────────────
const QueueQuery = z.object({
  status: z.enum(STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  source: z.enum(SOURCE).optional(),
  assignedToUserId: z.string().optional(),
  mine: z.coerce.boolean().optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

supportRouter.get('/queue', authenticate, STAFF, async (req: Request, res: Response): Promise<void> => {
  const parsed = QueueQuery.safeParse(req.query);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.message, 422); return; }
  const { mine, ...f } = parsed.data;
  try {
    const result = await listTickets({
      ...f,
      assignedToUserId: mine ? req.user!.id : f.assignedToUserId,
    });
    ok(res, result);
  } catch (e) { handle(res, e, 'Failed to load queue'); }
});

// ── GET /support/stats — unified signal counts ───────────────────────────────
supportRouter.get('/stats', authenticate, STAFF, async (_req: Request, res: Response): Promise<void> => {
  try { ok(res, await getStats()); }
  catch (e) { handle(res, e, 'Failed to load stats'); }
});

// ── GET /support/staff — SUPPORT + ADMIN roster for reassignment ─────────────
supportRouter.get('/staff', authenticate, STAFF, async (_req: Request, res: Response): Promise<void> => {
  try { ok(res, { staff: await listStaff() }); }
  catch (e) { handle(res, e, 'Failed to load staff'); }
});

// ── GET /support/reports — chat-abuse triage list ────────────────────────────
supportRouter.get('/reports', authenticate, STAFF, async (req: Request, res: Response): Promise<void> => {
  const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
  try { ok(res, { reports: await listChatReports(status) }); }
  catch (e) { handle(res, e, 'Failed to load reports'); }
});

// ── POST /support/reports/:id/action — dismiss / escalate ────────────────────
const ReportAction = z.object({ action: z.enum(['DISMISS', 'ESCALATE']) });
supportRouter.post('/reports/:id/action', authenticate, STAFF, async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'id required', 422); return; }
  const parsed = ReportAction.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.message, 422); return; }
  try { ok(res, await actOnChatReport(id, req.user!.id, parsed.data.action)); }
  catch (e) { handle(res, e, 'Failed to action report'); }
});

// ── POST /support/tickets — raise a ticket (any authenticated user) ───────────
const CreateTicket = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.enum(CATEGORY).optional(),
  priority: z.enum(PRIORITY).optional(),
  source: z.enum(SOURCE).optional(),
  linkedRefType: z.string().trim().max(32).optional(),
  linkedRefId: z.string().trim().max(100).optional(),
});
supportRouter.post('/tickets', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateTicket.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.message, 422); return; }
  const isStaff = req.user!.role === 'SUPPORT' || req.user!.role === 'ADMIN';
  try {
    // Non-staff may only file plain user tickets (no elevated source/priority spoofing).
    const created = await createTicket(
      isStaff
        ? parsed.data
        : { subject: parsed.data.subject, description: parsed.data.description, category: parsed.data.category, source: 'USER' },
      req.user!.id,
    );
    ok(res, created, 201);
  } catch (e) { handle(res, e, 'Failed to create ticket'); }
});

// ── GET /support/tickets/:id — detail (staff, or the raiser) ─────────────────
supportRouter.get('/tickets/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'id required', 422); return; }
  try {
    const isStaff = req.user!.role === 'SUPPORT' || req.user!.role === 'ADMIN';
    if (!isStaff && !(await isRaiser(id, req.user!.id))) {
      err(res, 'FORBIDDEN', 'Not permitted', 403); return;
    }
    const ticket = await getTicket(id);
    // Non-staff never see internal notes.
    if (!isStaff) ticket.messages = ticket.messages.filter((m) => !m.isInternalNote);
    ok(res, ticket);
  } catch (e) { handle(res, e, 'Failed to load ticket'); }
});

// ── PATCH /support/tickets/:id — assign / prioritise / status (staff) ────────
const PatchTicket = z.object({
  status: z.enum(STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  assignedToUserId: z.string().nullable().optional(),
});
supportRouter.patch('/tickets/:id', authenticate, STAFF, async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'id required', 422); return; }
  const parsed = PatchTicket.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.message, 422); return; }
  try {
    await updateTicket(id, req.user!.id, parsed.data as {
      status?: TicketStatus; priority?: TicketPriority; assignedToUserId?: string | null;
    });
    ok(res, { updated: true });
  } catch (e) { handle(res, e, 'Failed to update ticket'); }
});

// ── POST /support/tickets/:id/resolve (staff) ────────────────────────────────
supportRouter.post('/tickets/:id/resolve', authenticate, STAFF, async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'id required', 422); return; }
  try { await updateTicket(id, req.user!.id, { status: 'RESOLVED' }); ok(res, { resolved: true }); }
  catch (e) { handle(res, e, 'Failed to resolve ticket'); }
});

// ── POST /support/tickets/:id/messages — reply / internal note ───────────────
const AddMessage = z.object({
  body: z.string().trim().min(1).max(5000),
  isInternalNote: z.boolean().optional(),
});
supportRouter.post('/tickets/:id/messages', authenticate, async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'];
  if (!id) { err(res, 'VALIDATION_ERROR', 'id required', 422); return; }
  const parsed = AddMessage.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.message, 422); return; }
  const isStaff = req.user!.role === 'SUPPORT' || req.user!.role === 'ADMIN';
  if (!isStaff && !(await isRaiser(id, req.user!.id))) { err(res, 'FORBIDDEN', 'Not permitted', 403); return; }
  try {
    await addMessage(id, req.user!.id, parsed.data.body, isStaff ? !!parsed.data.isInternalNote : false);
    ok(res, { added: true }, 201);
  } catch (e) { handle(res, e, 'Failed to add message'); }
});

async function isRaiser(ticketId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ raisedByUserId: supportTickets.raisedByUserId })
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  return !!row && row.raisedByUserId === userId;
}
