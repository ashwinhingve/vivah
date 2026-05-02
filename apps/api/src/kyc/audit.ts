// ─────────────────────────────────────────────────────────────────────────────
// KYC audit log writer. Every state-changing operation MUST call this.
// Failures are swallowed — auditing must never block the main flow — but they
// are logged so they surface in monitoring.
// ─────────────────────────────────────────────────────────────────────────────
import { db } from '../lib/db.js';
import { kycAuditLog } from '@smartshaadi/db';
import type { KycEventType, KycVerificationStatus, KycLevel } from '@smartshaadi/types';

export interface AuditArgs {
  profileId:  string;
  eventType:  KycEventType;
  actorId?:   string | null;
  actorRole?: 'USER' | 'ADMIN' | 'SYSTEM' | null;
  fromStatus?: KycVerificationStatus | null;
  toStatus?:  KycVerificationStatus | null;
  fromLevel?: KycLevel | null;
  toLevel?:   KycLevel | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?:  Record<string, unknown> | null;
}

export async function recordKycAuditEvent(args: AuditArgs): Promise<void> {
  try {
    await db.insert(kycAuditLog).values({
      profileId:  args.profileId,
      eventType:  args.eventType,
      actorId:    args.actorId ?? null,
      actorRole:  args.actorRole ?? 'SYSTEM',
      fromStatus: args.fromStatus ?? null,
      toStatus:   args.toStatus ?? null,
      fromLevel:  args.fromLevel ?? null,
      toLevel:    args.toLevel ?? null,
      ipAddress:  args.ipAddress ?? null,
      userAgent:  args.userAgent ?? null,
      metadata:   args.metadata ?? null,
    });
  } catch (e) {
    console.error('[kyc/audit] failed to record event', args.eventType, e);
  }
}
