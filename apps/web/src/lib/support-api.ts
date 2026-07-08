/**
 * Support console — server-side read helpers + wire types.
 *
 * Mirrors the DTOs returned by apps/api/src/support/service.ts. Read-only fetches
 * use fetchAuth (Server Components only); mutations live in colocated actions.ts.
 */
import { fetchAuth } from './server-fetch';

export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketCategory =
  | 'ACCOUNT' | 'PAYMENT' | 'BOOKING' | 'MATCH_ABUSE' | 'KYC' | 'VENDOR' | 'TECHNICAL' | 'OTHER';
export type TicketSource = 'USER' | 'CHAT_REPORT' | 'DISPUTE' | 'KYC_APPEAL' | 'SYSTEM';

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

export interface ChatReportView {
  id: string;
  matchRequestId: string;
  reporterProfileId: string;
  reporterName: string | null;
  reportedProfileId: string | null;
  reportedName: string | null;
  messageExcerpt: string | null;
  reason: string;
  status: string;
  createdAt: string;
}

export interface StaffOption {
  id: string;
  name: string | null;
}

export interface QueueParams {
  status?: TicketStatus;
  priority?: TicketPriority;
  source?: TicketSource;
  mine?: boolean;
  q?: string;
  page?: number;
}

export async function fetchSupportQueue(
  params: QueueParams,
): Promise<{ items: TicketListItem[]; total: number } | null> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.priority) qs.set('priority', params.priority);
  if (params.source) qs.set('source', params.source);
  if (params.mine) qs.set('mine', 'true');
  if (params.q) qs.set('q', params.q);
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', '25');
  return fetchAuth<{ items: TicketListItem[]; total: number }>(`/api/v1/support/queue?${qs.toString()}`);
}

export async function fetchSupportStats(): Promise<SupportStats | null> {
  return fetchAuth<SupportStats>('/api/v1/support/stats');
}

export async function fetchTicket(id: string): Promise<TicketDetail | null> {
  return fetchAuth<TicketDetail>(`/api/v1/support/tickets/${id}`);
}

export async function fetchChatReports(status?: string): Promise<{ reports: ChatReportView[] } | null> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchAuth<{ reports: ChatReportView[] }>(`/api/v1/support/reports${qs}`);
}

/** SUPPORT + ADMIN roster for the ticket reassignment picker. */
export async function fetchSupportStaff(): Promise<{ staff: StaffOption[] } | null> {
  return fetchAuth<{ staff: StaffOption[] }>('/api/v1/support/staff');
}
