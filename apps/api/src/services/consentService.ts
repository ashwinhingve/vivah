/**
 * GDPR consent ledger service — append-only audit trail.
 *
 * The consent_ledger table is never UPDATEd to change consent state. Instead:
 *   - recordConsent inserts a new row.
 *   - withdrawConsent marks the current row's withdrawn_at AND inserts a
 *     new consent_given=false row so the timeline reads cleanly.
 *
 * Active consent for (userId, type) = newest row with withdrawn_at IS NULL
 * AND consent_given = true.
 */

import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { consentLedger } from '@smartshaadi/db';
import { db } from '../lib/db.js';

export type ConsentType =
  | 'PRIVACY_POLICY'
  | 'TERMS_OF_SERVICE'
  | 'MARKETING_EMAILS'
  | 'DATA_SHARING'
  | 'COOKIE_TRACKING'
  | 'ML_TRAINING';

export interface ConsentRow {
  id:              string;
  userId:          string;
  consentType:     string;
  consentVersion:  string;
  consentGiven:    boolean;
  consentedAt:     Date;
  ipAddress:       string | null;
  userAgent:       string | null;
  withdrawnAt:     Date | null;
}

export interface RecordConsentInput {
  userId:          string;
  consentType:     ConsentType;
  consentVersion:  string;
  consentGiven:    boolean;
  ipAddress?:      string | null;
  userAgent?:      string | null;
}

export async function recordConsent(input: RecordConsentInput): Promise<ConsentRow> {
  const [row] = await db.insert(consentLedger).values({
    userId:         input.userId,
    consentType:    input.consentType,
    consentVersion: input.consentVersion,
    consentGiven:   input.consentGiven,
    ipAddress:      input.ipAddress ?? null,
    userAgent:      input.userAgent ?? null,
  }).returning();
  return row as ConsentRow;
}

/**
 * Returns the newest non-withdrawn row per consent_type for the user.
 * Withdrawn entries (withdrawn_at IS NOT NULL) are filtered out. The result
 * may include rows where consent_given=false — callers must check the flag.
 */
export async function getActiveConsents(userId: string): Promise<ConsentRow[]> {
  const rows = await db.select()
    .from(consentLedger)
    .where(and(eq(consentLedger.userId, userId), isNull(consentLedger.withdrawnAt)))
    .orderBy(desc(consentLedger.consentedAt));

  // Dedupe to the most-recent row per consent_type while preserving ordering.
  const seen = new Set<string>();
  const latest: ConsentRow[] = [];
  for (const r of rows as ConsentRow[]) {
    if (seen.has(r.consentType)) continue;
    seen.add(r.consentType);
    latest.push(r);
  }
  return latest;
}

export async function hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
  const active = await getActiveConsents(userId);
  const row = active.find(r => r.consentType === consentType);
  return Boolean(row?.consentGiven);
}

/**
 * Marks every currently-active row for this consentType as withdrawn, then
 * inserts a new audit row with consent_given=false. Returns the audit row.
 */
export async function withdrawConsent(input: {
  userId:      string;
  consentType: ConsentType;
  ipAddress?:  string | null;
  userAgent?:  string | null;
}): Promise<ConsentRow> {
  await db.update(consentLedger)
    .set({ withdrawnAt: sql`now()` })
    .where(and(
      eq(consentLedger.userId,      input.userId),
      eq(consentLedger.consentType, input.consentType),
      isNull(consentLedger.withdrawnAt),
    ));

  return recordConsent({
    userId:         input.userId,
    consentType:    input.consentType,
    consentVersion: 'withdrawal',
    consentGiven:   false,
    ipAddress:      input.ipAddress ?? null,
    userAgent:      input.userAgent ?? null,
  });
}
