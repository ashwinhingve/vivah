/**
 * Smart Shaadi — Wedding extras API client (server-side)
 *
 * Thin wrappers around fetchAuth that point at the new wedding extras
 * endpoints. Use from Server Components and Server Actions.
 */

import { cookies } from 'next/headers';
import { fetchAuth } from './server-fetch';
import type {
  WeddingExpense, ExpenseSummary, TimelineEvent, SeatingTable,
  WeddingDocument, MoodBoardItem, WeddingMember, WeddingMemberInvite,
  WeddingVendorAssignment, WeddingWebsite, RegistryItem,
  ActivityLogEntry, TaskComment, TaskAttachment, PublicRsvpView,
  ManagedWeddingSummary, CoordinatorAssignment, WeddingIncident,
  DayOfSnapshot, CeremonyBudgetRollup,
  GuestRich, RsvpAnalytics, RsvpDeadline, RsvpCustomQuestion,
  GuestAddress, GuestCeremonyPref,
  FamilyView, FamilyMember, FamilyVerification,
} from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

interface MutateOptions {
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function mutateApi<T = unknown>(path: string, opts: MutateOptions): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await cookieHeader(),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
    const json = await res.json() as { success: boolean; data?: T; error?: { message?: string } | string };
    if (!json.success) {
      const message = typeof json.error === 'string' ? json.error : (json.error?.message ?? 'Request failed');
      return { ok: false, error: message };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export const fetchExpenses = (id: string) => fetchAuth<{ expenses: WeddingExpense[] }>(`/api/v1/weddings/${id}/expenses`);
export const fetchExpenseSummary = (id: string) => fetchAuth<ExpenseSummary>(`/api/v1/weddings/${id}/expenses/summary`);

export const fetchTimeline = (id: string) => fetchAuth<{ events: TimelineEvent[] }>(`/api/v1/weddings/${id}/timeline`);

export const fetchSeating = (id: string) => fetchAuth<{ tables: SeatingTable[] }>(`/api/v1/weddings/${id}/seating/tables`);

export const fetchDocuments = (id: string) => fetchAuth<{ documents: WeddingDocument[] }>(`/api/v1/weddings/${id}/documents`);

export const fetchMoodboard = (id: string) => fetchAuth<{ items: MoodBoardItem[] }>(`/api/v1/weddings/${id}/moodboard`);

export const fetchMembers = (id: string) => fetchAuth<{ members: WeddingMember[] }>(`/api/v1/weddings/${id}/members`);
export const fetchInvites = (id: string) => fetchAuth<{ invites: WeddingMemberInvite[] }>(`/api/v1/weddings/${id}/members/invites`);

export const fetchVendorAssignments = (id: string) => fetchAuth<{ assignments: WeddingVendorAssignment[] }>(`/api/v1/weddings/${id}/vendors`);

export const fetchWebsite = (id: string) => fetchAuth<WeddingWebsite | null>(`/api/v1/weddings/${id}/website`);

export const fetchRegistry = (id: string) => fetchAuth<{ items: RegistryItem[] }>(`/api/v1/weddings/${id}/registry`);

export const fetchActivity = (id: string, limit = 30) => fetchAuth<{ entries: ActivityLogEntry[] }>(`/api/v1/weddings/${id}/activity?limit=${limit}`);

export const fetchTaskComments = (id: string, taskId: string) => fetchAuth<{ comments: TaskComment[] }>(`/api/v1/weddings/${id}/tasks/${taskId}/comments`);
export const fetchTaskAttachments = (id: string, taskId: string) => fetchAuth<{ attachments: TaskAttachment[] }>(`/api/v1/weddings/${id}/tasks/${taskId}/attachments`);

// ── Coordinator + day-of + incidents (Multi-Event) ───────────────────────────

export const fetchManagedWeddings = () =>
  fetchAuth<{ weddings: ManagedWeddingSummary[] }>(`/api/v1/coordinator/weddings`);

export const fetchCoordinatorsForWedding = (id: string) =>
  fetchAuth<{ coordinators: Array<CoordinatorAssignment & { name: string | null; email: string | null }> }>(
    `/api/v1/weddings/${id}/coordinators`
  );

export const fetchDayOfSnapshot = (id: string) =>
  fetchAuth<DayOfSnapshot>(`/api/v1/weddings/${id}/day-of/snapshot`);

export const fetchIncidents = (id: string, opts?: { open?: boolean; severity?: string }) => {
  const qs = new URLSearchParams();
  if (opts?.open) qs.set('open', '1');
  if (opts?.severity) qs.set('severity', opts.severity);
  const tail = qs.toString() ? `?${qs.toString()}` : '';
  return fetchAuth<{ incidents: WeddingIncident[] }>(`/api/v1/weddings/${id}/incidents${tail}`);
};

export const fetchCeremonyBudget = (id: string) =>
  fetchAuth<CeremonyBudgetRollup>(`/api/v1/weddings/${id}/expenses/by-ceremony`);

// ── Guests (rich) + analytics + deadline + custom questions ──────────────────

export const fetchGuestsRich    = (id: string) => fetchAuth<{ guests: GuestRich[] }>(`/api/v1/weddings/${id}/guests`);
export const fetchGuestRich     = (id: string, gid: string) => fetchAuth<GuestRich>(`/api/v1/weddings/${id}/guests/${gid}`);
export const fetchRsvpAnalytics = (id: string) => fetchAuth<RsvpAnalytics>(`/api/v1/weddings/${id}/guests/analytics`);
export const fetchRsvpDeadline  = (id: string) => fetchAuth<RsvpDeadline | null>(`/api/v1/weddings/${id}/rsvp-deadline`);
export const fetchRsvpQuestions = (id: string) => fetchAuth<{ questions: RsvpCustomQuestion[] }>(`/api/v1/weddings/${id}/rsvp-questions`);
export const fetchGuestAddress  = (id: string, gid: string) => fetchAuth<GuestAddress | null>(`/api/v1/weddings/${id}/guests/${gid}/address`);
export const fetchGuestCeremonyPrefs = (id: string, gid: string) => fetchAuth<{ prefs: GuestCeremonyPref[] }>(`/api/v1/weddings/${id}/guests/${gid}/ceremony-prefs`);

// ── Family (matrimonial side) ────────────────────────────────────────────────

export const fetchFamilyView          = () => fetchAuth<FamilyView>(`/api/v1/profiles/me/family`);
export const fetchFamilyMembers       = () => fetchAuth<{ members: FamilyMember[] }>(`/api/v1/profiles/me/family/members`);
export const fetchFamilyVerification  = () => fetchAuth<FamilyVerification | null>(`/api/v1/profiles/me/family/verification`);

// ── Public reads (no auth) ────────────────────────────────────────────────────

export async function fetchPublicRsvp(token: string): Promise<PublicRsvpView | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/rsvp/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json() as { success: boolean; data: PublicRsvpView };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function fetchPublicWebsite(slug: string, password?: string): Promise<unknown | null> {
  const params = password ? `?password=${encodeURIComponent(password)}` : '';
  try {
    const res = await fetch(`${API_BASE}/api/v1/wedding-sites/${slug}${params}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json() as { success: boolean; data: unknown };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
