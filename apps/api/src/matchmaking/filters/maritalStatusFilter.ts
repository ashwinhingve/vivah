/**
 * Smart Shaadi — Marital Status Hard Filter (Bilateral)
 *
 * Per CLAUDE.md rule 10: reciprocal matching — both sides must opt in.
 * A candidate only surfaces when BOTH the user and the candidate would
 * accept each other's marital status.
 *
 * Acceptance rules (per-side):
 *   NEVER_MARRIED candidate  → always accepted by any user
 *   DIVORCED candidate       → accepted only when the viewer's
 *                              preferred_marital_statuses includes DIVORCED
 *                              OR the viewer's community zone has
 *                              divorcee_support_enabled == true
 *   WIDOWED candidate        → accepted only when the viewer's
 *                              preferred_marital_statuses includes WIDOWED
 *                              OR the viewer's community zone has
 *                              divorcee_support_enabled == true
 *   SEPARATED candidate      → same rule as DIVORCED
 *
 * Privacy: the profile classification (DIVORCED / WIDOWED) is NEVER
 * surfaced to the other party without their consent — the filter simply
 * withholds the match rather than disclosing the status.
 */

export type MaritalStatusValue = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';

export interface MaritalStatusProfile {
  id: string
  /** The person's own marital status. */
  maritalStatus?: MaritalStatusValue | null
  /** What marital statuses they are willing to see in a partner. */
  preferredMaritalStatuses?: MaritalStatusValue[] | null
  /** Whether their community zone has divorcee/widow support enabled. */
  divorceeSupport?: boolean
}

/**
 * Returns true when `viewer` is willing to see `subject`'s marital status.
 * This is a one-directional check; use `passesMaritalStatusFilter` for the
 * bilateral check required by CLAUDE.md rule 10.
 */
function oneSideAccepts(
  viewer: MaritalStatusProfile,
  subject: MaritalStatusProfile,
): boolean {
  const subjectStatus = subject.maritalStatus ?? 'NEVER_MARRIED';

  // NEVER_MARRIED is universally accepted
  if (subjectStatus === 'NEVER_MARRIED') return true;

  // DIVORCED / WIDOWED / SEPARATED: need explicit opt-in
  const prefs = viewer.preferredMaritalStatuses ?? [];
  if (prefs.includes(subjectStatus)) return true;

  // Community-zone divorcee support acts as implicit opt-in for DIVORCED and WIDOWED
  if (viewer.divorceeSupport === true) return true;

  return false;
}

/**
 * Bilateral check: both the user and the candidate must accept each other's
 * marital status for the match to surface.
 *
 * @param user      - The person whose feed is being built
 * @param candidate - The profile being evaluated for inclusion
 * @returns true when neither side is filtered out by the other's status
 */
export function passesMaritalStatusFilter(
  user: MaritalStatusProfile,
  candidate: MaritalStatusProfile,
): boolean {
  // User must accept the candidate's status
  const userAcceptsCandidate = oneSideAccepts(user, candidate);
  if (!userAcceptsCandidate) return false;

  // Candidate must accept the user's status (bilateral — CLAUDE.md rule 10)
  const candidateAcceptsUser = oneSideAccepts(candidate, user);
  return candidateAcceptsUser;
}
