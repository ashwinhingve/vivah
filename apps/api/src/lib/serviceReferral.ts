/**
 * Shared mapper: service_referrals DB row → ServiceReferral API DTO.
 * Used by both the lending (6.2) and insurance (6.3) shells. bigint paise
 * columns are serialized to strings (JSON-safe, and never lossy for money).
 */

import type { ServiceReferral, ServiceReferralKind, ServiceReferralStatus } from '@smartshaadi/types';

export interface ServiceReferralRow {
  id: string;
  profileId: string;
  kind: string;
  status: string;
  partnerRef: string | null;
  context: string;
  contextId: string | null;
  consentAt: Date | null;
  consentVersion: string | null;
  principalPaise: bigint | null;
  commissionPaise: bigint | null;
  currency: string;
  mock: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export function toServiceReferral(row: ServiceReferralRow): ServiceReferral {
  return {
    id:              row.id,
    profileId:       row.profileId,
    kind:            row.kind as ServiceReferralKind,
    status:          row.status as ServiceReferralStatus,
    partnerRef:      row.partnerRef,
    context:         row.context,
    contextId:       row.contextId,
    consentAt:       row.consentAt ? row.consentAt.toISOString() : null,
    consentVersion:  row.consentVersion,
    principalPaise:  row.principalPaise != null ? row.principalPaise.toString() : null,
    commissionPaise: row.commissionPaise != null ? row.commissionPaise.toString() : null,
    currency:        row.currency,
    mock:            row.mock,
    metadata:        (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt:       row.createdAt.toISOString(),
    updatedAt:       row.updatedAt.toISOString(),
  };
}
