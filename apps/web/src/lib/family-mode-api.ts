/**
 * Family Mode API client (Phase 3 P3 — items 9 + 10).
 *
 * Server-side fetches forward the Better Auth session cookie via `cookie`
 * argument. Browser-side fetches rely on `credentials: 'include'`.
 */

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export interface FamilyRating {
  id:                    string;
  raterUserId:           string;
  subjectProfileId:      string;
  candidateProfileId:    string;
  overallScore:          number;
  compatibilityConcerns: string[] | null;
  notes:                 string | null;
  ratedAt:               string;
  raterRelationship:     string | null;
  raterDisplayName:      string | null;
}

export interface JointScore {
  jointScore:        number | null;
  familySignalCount: number;
  agreementPct:      number | null;
  userMatchScore:    number | null;
  familyAvgScore:    number | null;
}

export interface ParentLink {
  id:                  string;
  parentUserId:        string;
  childUserId:         string;
  relationship:        'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SIBLING';
  permissions:         'VIEW_ONLY' | 'EDIT_PROFILE' | 'DRAFT_ACTIONS' | 'FULL_PROXY';
  childConsentStatus:  'PENDING' | 'APPROVED' | 'REVOKED';
  childConsentedAt:    string | null;
  createdAt:           string;
  revokedAt:           string | null;
}

export type ParentActionType =
  | 'SEND_INTEREST' | 'ACCEPT_INTEREST' | 'REJECT_INTEREST'
  | 'SEND_MESSAGE' | 'UPDATE_PROFILE' | 'BLOCK_USER';

export type ParentActionStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED' | 'FAILED';

export interface DraftedAction {
  id:                string;
  parentUserId:      string;
  childUserId:       string;
  actionType:        ParentActionType;
  payload:           Record<string, unknown>;
  status:            ParentActionStatus;
  parentDraftedAt:   string;
  childRespondedAt:  string | null;
  executedAt:        string | null;
  expiresAt:         string | null;
  errorMessage:      string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
}

async function getJson<T>(path: string, cookie?: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...(cookie !== undefined
        ? { headers: { cookie } }
        : { credentials: 'include' as const }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiEnvelope<T>;
    return json.success ? (json.data ?? null) : null;
  } catch { return null; }
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as ApiEnvelope<T>;
    return json.success ? (json.data ?? null) : null;
  } catch { return null; }
}

async function deleteJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = (await res.json()) as ApiEnvelope<T>;
    return json.success ? (json.data ?? null) : null;
  } catch { return null; }
}

// ── Ratings ──────────────────────────────────────────────────────────────────

export interface RatingsResponse { ratings: FamilyRating[]; joint: JointScore }

export async function getRatings(
  subjectProfileId: string,
  candidateProfileId: string,
  cookie?: string,
): Promise<RatingsResponse | null> {
  return getJson<RatingsResponse>(`/api/v1/family-mode/ratings/${subjectProfileId}/${candidateProfileId}`, cookie);
}

export async function submitRating(input: {
  subject_profile_id: string;
  candidate_profile_id: string;
  overall_score: number;
  concerns?: string[];
  notes?: string;
}): Promise<{ ratingId: string; joint: JointScore } | null> {
  return postJson(`/api/v1/family-mode/ratings`, input);
}

export async function deleteRating(ratingId: string): Promise<{ deleted: boolean } | null> {
  return deleteJson(`/api/v1/family-mode/ratings/${ratingId}`);
}

// ── Parent links ─────────────────────────────────────────────────────────────

export interface MyLinks { as_parent: ParentLink[]; as_child: ParentLink[] }

export async function getMyLinks(cookie?: string): Promise<MyLinks | null> {
  return getJson<MyLinks>(`/api/v1/family-mode/parent/links/my`, cookie);
}

export async function createLink(input: {
  child_user_id: string;
  relationship: ParentLink['relationship'];
  requested_permissions?: ParentLink['permissions'];
}): Promise<ParentLink | null> {
  return postJson(`/api/v1/family-mode/parent/links`, input);
}

export async function approveLink(linkId: string): Promise<ParentLink | null> {
  return postJson(`/api/v1/family-mode/parent/links/${linkId}/approve`, {});
}

export async function revokeLink(linkId: string): Promise<{ revoked: boolean } | null> {
  return deleteJson(`/api/v1/family-mode/parent/links/${linkId}`);
}

// ── Parent actions ───────────────────────────────────────────────────────────

export async function getPendingActions(cookie?: string): Promise<DraftedAction[] | null> {
  return getJson<DraftedAction[]>(`/api/v1/family-mode/parent/actions/pending`, cookie);
}

export async function getDraftedActions(cookie?: string): Promise<DraftedAction[] | null> {
  return getJson<DraftedAction[]>(`/api/v1/family-mode/parent/actions/drafted`, cookie);
}

export async function draftAction(input: {
  child_user_id: string;
  action_type: ParentActionType;
  payload: Record<string, unknown>;
}): Promise<DraftedAction | null> {
  return postJson(`/api/v1/family-mode/parent/actions`, input);
}

export async function approveAction(actionId: string): Promise<DraftedAction | null> {
  return postJson(`/api/v1/family-mode/parent/actions/${actionId}/approve`, {});
}

export async function rejectAction(actionId: string): Promise<DraftedAction | null> {
  return postJson(`/api/v1/family-mode/parent/actions/${actionId}/reject`, {});
}
