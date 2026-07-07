/**
 * Smart Shaadi — Support Console service
 *
 * Ticket lifecycle (create / assign / prioritise / message / resolve) with an
 * append-only ticket_events audit trail, plus the unified-signal counts that
 * make the console a single triage surface: open tickets, open chat-abuse
 * reports (Mongo, mock-guarded), disputed bookings, and pending KYC appeals.
 */
import { and, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { shouldUseMockMongo } from '../lib/env.js';
import {
  supportTickets,
  ticketMessages,
  ticketEvents,
  bookings,
  kycAppeals,
  user,
} from '@smartshaadi/db';
import { ChatReport } from '../infrastructure/mongo/models/ChatReport.js';

export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketCategory =
  | 'ACCOUNT' | 'PAYMENT' | 'BOOKING' | 'MATCH_ABUSE' | 'KYC' | 'VENDOR' | 'TECHNICAL' | 'OTHER';
export type TicketSource = 'USER' | 'CHAT_REPORT' | 'DISPUTE' | 'KYC_APPEAL' | 'SYSTEM';

export interface SupportError extends Error { code: string; status: number }
function fail(message: string, code: string, status: number): SupportError {
  return Object.assign(new Error(message), { code, status });
}

// SLA target (ms) from priority — drives slaDueAt + the "overdue" count.
const SLA_MS: Record<TicketPriority, number> = {
  URGENT: 4 * 3_600_000,
  HIGH: 8 * 3_600_000,
  NORMAL: 24 * 3_600_000,
  LOW: 72 * 3_600_000,
};

export interface TicketListItem {
  id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  assignedToUserId: string | null;
  assignedToName: string | null;
  raisedByName: string | null;
  slaDueAt: string | null;
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QueueFilters {
  status?: TicketStatus | undefined;
  priority?: TicketPriority | undefined;
  source?: TicketSource | undefined;
  assignedToUserId?: string | undefined;
  q?: string | undefined;
  page: number;
  limit: number;
}

interface UserRow { id: string; name: string | null }

function mapListRow(
  t: typeof supportTickets.$inferSelect,
  assignee: UserRow | null,
  raiser: UserRow | null,
): TicketListItem {
  const overdue =
    !!t.slaDueAt &&
    (t.status === 'OPEN' || t.status === 'PENDING') &&
    t.slaDueAt.getTime() < Date.now();
  return {
    id: t.id,
    subject: t.subject,
    category: t.category as TicketCategory,
    priority: t.priority as TicketPriority,
    status: t.status as TicketStatus,
    source: t.source as TicketSource,
    assignedToUserId: t.assignedToUserId,
    assignedToName: assignee?.name ?? null,
    raisedByName: raiser?.name ?? null,
    slaDueAt: t.slaDueAt?.toISOString() ?? null,
    overdue,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function listTickets(f: QueueFilters): Promise<{ items: TicketListItem[]; total: number }> {
  const conds = [];
  if (f.status) conds.push(eq(supportTickets.status, f.status));
  if (f.priority) conds.push(eq(supportTickets.priority, f.priority));
  if (f.source) conds.push(eq(supportTickets.source, f.source));
  if (f.assignedToUserId) conds.push(eq(supportTickets.assignedToUserId, f.assignedToUserId));
  if (f.q) conds.push(ilike(supportTickets.subject, `%${f.q}%`));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({ t: supportTickets, aName: user.name, aId: user.id })
    .from(supportTickets)
    .leftJoin(user, eq(user.id, supportTickets.assignedToUserId))
    .where(where)
    .orderBy(desc(supportTickets.createdAt))
    .limit(f.limit)
    .offset((f.page - 1) * f.limit);

  // Second pass for raiser names (kept simple; volumes are small in the console).
  const raiserIds = rows.map((r) => r.t.raisedByUserId).filter((x): x is string => !!x);
  const raisers = raiserIds.length
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, raiserIds))
    : [];
  const raiserById = new Map(raisers.map((r) => [r.id, r]));

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: count() })
    .from(supportTickets)
    .where(where);

  const items = rows.map((r) =>
    mapListRow(
      r.t,
      r.aId ? { id: r.aId, name: r.aName } : null,
      r.t.raisedByUserId ? raiserById.get(r.t.raisedByUserId) ?? null : null,
    ),
  );
  return { items, total: Number(total) };
}

export interface TicketMessageView {
  id: string;
  authorUserId: string | null;
  authorName: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
}
export interface TicketEventView {
  id: string;
  eventType: string;
  actorName: string | null;
  meta: unknown;
  createdAt: string;
}
export interface TicketDetail extends TicketListItem {
  description: string | null;
  linkedRefType: string | null;
  linkedRefId: string | null;
  messages: TicketMessageView[];
  events: TicketEventView[];
}

export async function getTicket(id: string): Promise<TicketDetail> {
  const [row] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  if (!row) throw fail('Ticket not found', 'NOT_FOUND', 404);

  const [assignee] = row.assignedToUserId
    ? await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, row.assignedToUserId)).limit(1)
    : [];
  const [raiser] = row.raisedByUserId
    ? await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, row.raisedByUserId)).limit(1)
    : [];

  const msgs = await db
    .select({ m: ticketMessages, name: user.name })
    .from(ticketMessages)
    .leftJoin(user, eq(user.id, ticketMessages.authorUserId))
    .where(eq(ticketMessages.ticketId, id))
    .orderBy(ticketMessages.createdAt);

  const evs = await db
    .select({ e: ticketEvents, name: user.name })
    .from(ticketEvents)
    .leftJoin(user, eq(user.id, ticketEvents.actorUserId))
    .where(eq(ticketEvents.ticketId, id))
    .orderBy(desc(ticketEvents.createdAt));

  const base = mapListRow(row, assignee ?? null, raiser ?? null);
  return {
    ...base,
    description: row.description,
    linkedRefType: row.linkedRefType,
    linkedRefId: row.linkedRefId,
    messages: msgs.map((r) => ({
      id: r.m.id,
      authorUserId: r.m.authorUserId,
      authorName: r.name,
      body: r.m.body,
      isInternalNote: r.m.isInternalNote,
      createdAt: r.m.createdAt.toISOString(),
    })),
    events: evs.map((r) => ({
      id: r.e.id,
      eventType: r.e.eventType,
      actorName: r.name,
      meta: r.e.meta,
      createdAt: r.e.createdAt.toISOString(),
    })),
  };
}

async function logEvent(
  ticketId: string,
  actorUserId: string | null,
  eventType: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.insert(ticketEvents).values({
    ticketId,
    actorUserId,
    // eventType is a pg enum; the caller passes a valid member.
    eventType: eventType as typeof ticketEvents.$inferInsert.eventType,
    meta: meta ?? null,
  });
}

export interface CreateTicketInput {
  subject: string;
  description?: string | undefined;
  category?: TicketCategory | undefined;
  priority?: TicketPriority | undefined;
  source?: TicketSource | undefined;
  linkedRefType?: string | undefined;
  linkedRefId?: string | undefined;
}

export async function createTicket(
  input: CreateTicketInput,
  raisedByUserId: string | null,
): Promise<{ id: string }> {
  const priority = input.priority ?? 'NORMAL';
  const slaDueAt = new Date(Date.now() + SLA_MS[priority]);
  const [row] = await db
    .insert(supportTickets)
    .values({
      subject: input.subject,
      description: input.description ?? null,
      category: (input.category ?? 'OTHER') as typeof supportTickets.$inferInsert.category,
      priority: priority as typeof supportTickets.$inferInsert.priority,
      source: (input.source ?? 'USER') as typeof supportTickets.$inferInsert.source,
      raisedByUserId,
      linkedRefType: input.linkedRefType ?? null,
      linkedRefId: input.linkedRefId ?? null,
      slaDueAt,
    })
    .returning({ id: supportTickets.id });
  if (!row) throw fail('Failed to create ticket', 'INTERNAL', 500);
  await logEvent(row.id, raisedByUserId, 'CREATED', { source: input.source ?? 'USER' });
  return { id: row.id };
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToUserId?: string | null;
}

export async function updateTicket(
  id: string,
  actorUserId: string,
  patch: UpdateTicketInput,
): Promise<void> {
  const [existing] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  if (!existing) throw fail('Ticket not found', 'NOT_FOUND', 404);

  const set: Partial<typeof supportTickets.$inferInsert> = { updatedAt: new Date() };
  if (patch.status && patch.status !== existing.status) {
    set.status = patch.status as typeof supportTickets.$inferInsert.status;
    if (patch.status === 'RESOLVED') {
      set.resolvedAt = new Date();
      set.resolvedByUserId = actorUserId;
    }
  }
  if (patch.priority && patch.priority !== existing.priority) {
    set.priority = patch.priority as typeof supportTickets.$inferInsert.priority;
  }
  if (patch.assignedToUserId !== undefined && patch.assignedToUserId !== existing.assignedToUserId) {
    set.assignedToUserId = patch.assignedToUserId;
  }

  await db.update(supportTickets).set(set).where(eq(supportTickets.id, id));

  if (set.status) {
    await logEvent(id, actorUserId, set.status === 'RESOLVED' ? 'RESOLVED' : 'STATUS_CHANGED', {
      from: existing.status,
      to: patch.status,
    });
  }
  if (set.priority) {
    await logEvent(id, actorUserId, 'PRIORITY_CHANGED', { from: existing.priority, to: patch.priority });
  }
  if (set.assignedToUserId !== undefined) {
    await logEvent(id, actorUserId, 'ASSIGNED', { to: patch.assignedToUserId });
  }
}

export async function addMessage(
  id: string,
  authorUserId: string,
  body: string,
  isInternalNote: boolean,
): Promise<void> {
  const [existing] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  if (!existing) throw fail('Ticket not found', 'NOT_FOUND', 404);
  await db.insert(ticketMessages).values({ ticketId: id, authorUserId, body, isInternalNote });
  const set: Partial<typeof supportTickets.$inferInsert> = { updatedAt: new Date() };
  if (!existing.firstRespondedAt && !isInternalNote) set.firstRespondedAt = new Date();
  await db.update(supportTickets).set(set).where(eq(supportTickets.id, id));
  await logEvent(id, authorUserId, 'MESSAGE_ADDED', { internal: isInternalNote });
}

// ── Unified signal stats ─────────────────────────────────────────────────────
export interface SupportStats {
  open: number;
  pending: number;
  overdue: number;
  resolvedToday: number;
  unassigned: number;
  byPriority: Record<TicketPriority, number>;
  openChatReports: number;
  disputedBookings: number;
  pendingKycAppeals: number;
}

export async function getStats(): Promise<SupportStats> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [open] = await db.select({ v: count() }).from(supportTickets).where(eq(supportTickets.status, 'OPEN'));
  const [pending] = await db.select({ v: count() }).from(supportTickets).where(eq(supportTickets.status, 'PENDING'));
  const [overdue] = await db
    .select({ v: count() })
    .from(supportTickets)
    .where(
      and(
        inArray(supportTickets.status, ['OPEN', 'PENDING']),
        sql`${supportTickets.slaDueAt} < now()`,
      ),
    );
  const [resolvedToday] = await db
    .select({ v: count() })
    .from(supportTickets)
    .where(and(eq(supportTickets.status, 'RESOLVED'), sql`${supportTickets.resolvedAt} >= ${startOfToday}`));
  const [unassigned] = await db
    .select({ v: count() })
    .from(supportTickets)
    .where(and(inArray(supportTickets.status, ['OPEN', 'PENDING']), sql`${supportTickets.assignedToUserId} is null`));

  const priorityRows = await db
    .select({ priority: supportTickets.priority, v: count() })
    .from(supportTickets)
    .where(inArray(supportTickets.status, ['OPEN', 'PENDING']))
    .groupBy(supportTickets.priority);
  const byPriority: Record<TicketPriority, number> = { LOW: 0, NORMAL: 0, HIGH: 0, URGENT: 0 };
  for (const r of priorityRows) byPriority[r.priority as TicketPriority] = Number(r.v);

  const [disputed] = await db.select({ v: count() }).from(bookings).where(eq(bookings.status, 'DISPUTED'));
  const [appeals] = await db.select({ v: count() }).from(kycAppeals).where(eq(kycAppeals.status, 'PENDING'));

  let openChatReports = 0;
  if (!shouldUseMockMongo) {
    openChatReports = await ChatReport.countDocuments({ status: 'OPEN' });
  }

  return {
    open: Number(open?.v ?? 0),
    pending: Number(pending?.v ?? 0),
    overdue: Number(overdue?.v ?? 0),
    resolvedToday: Number(resolvedToday?.v ?? 0),
    unassigned: Number(unassigned?.v ?? 0),
    byPriority,
    openChatReports,
    disputedBookings: Number(disputed?.v ?? 0),
    pendingKycAppeals: Number(appeals?.v ?? 0),
  };
}

// ── Chat-abuse report triage (Mongo, mock-guarded) ───────────────────────────
export interface ChatReportView {
  id: string;
  matchRequestId: string;
  reporterProfileId: string;
  reason: string;
  status: string;
  createdAt: string;
}

export async function listChatReports(status?: string): Promise<ChatReportView[]> {
  if (shouldUseMockMongo) return [];
  const filter = status ? { status } : {};
  const docs = await ChatReport.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  return docs.map((d: Record<string, unknown>) => ({
    id: String(d['_id']),
    matchRequestId: String(d['matchRequestId'] ?? ''),
    reporterProfileId: String(d['reporterProfileId'] ?? ''),
    reason: String(d['reason'] ?? ''),
    status: String(d['status'] ?? 'OPEN'),
    createdAt: d['createdAt'] instanceof Date ? (d['createdAt'] as Date).toISOString() : String(d['createdAt'] ?? ''),
  }));
}

/**
 * Triage a chat-abuse report: mark it REVIEWED/DISMISSED, and optionally spawn
 * a MATCH_ABUSE ticket linked back to the report for follow-up.
 */
export async function actOnChatReport(
  reportId: string,
  actorUserId: string,
  action: 'DISMISS' | 'ESCALATE',
): Promise<{ ticketId: string | null }> {
  if (shouldUseMockMongo) throw fail('Chat reports unavailable in mock mode', 'UNAVAILABLE', 503);
  const doc = await ChatReport.findById(reportId);
  if (!doc) throw fail('Report not found', 'NOT_FOUND', 404);

  if (action === 'DISMISS') {
    doc.status = 'DISMISSED';
    await doc.save();
    return { ticketId: null };
  }

  doc.status = 'REVIEWED';
  await doc.save();
  const { id } = await createTicket(
    {
      subject: `Chat abuse report — ${String(doc.reason)}`,
      description: `Escalated from chat-abuse report on match ${String(doc.matchRequestId)}.`,
      category: 'MATCH_ABUSE',
      priority: 'HIGH',
      source: 'CHAT_REPORT',
      linkedRefType: 'chat_report',
      linkedRefId: reportId,
    },
    actorUserId,
  );
  return { ticketId: id };
}
