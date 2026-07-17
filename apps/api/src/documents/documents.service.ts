/**
 * Smart Shaadi — Documents Service
 *
 * Contract lifecycle: DRAFT → SENT → SIGNED → VOID
 * All operations scoped by profileId (multi-tenant safety).
 * Mock e-sign until ESIGN_LIVE=true + real provider credentials.
 */

import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { contracts } from '@smartshaadi/db';
import { shouldUseMockR2, shouldUseMockEsign } from '../lib/env.js';
import { generateContractPdf } from './contract-pdf.js';
import { renderTemplate, flattenSections, type ContractData } from './templates.js';
import { asProfileId } from '@smartshaadi/types';
import type { ProfileId, ContractStatus, ESignProvider, Contract } from '@smartshaadi/types';

export class DocumentsError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'DocumentsError';
  }
}

export interface CreateContractInput {
  templateId: string;
  title: string;
  data: ContractData;
}

/**
 * Create a new contract in DRAFT status.
 * Computes contentHash immediately from rendered template.
 * All PDFs are generated on-demand; nothing stored until sent for signature.
 */
export async function createContract(
  profileId: ProfileId,
  input: CreateContractInput,
): Promise<Contract> {
  // Render template to get sections
  let sections;
  try {
    sections = renderTemplate(input.templateId, input.data);
  } catch (e) {
    throw new DocumentsError('INVALID_TEMPLATE', `Unknown template: ${input.templateId}`);
  }

  // Flatten to plain text for hashing (audit chain)
  const plainText = flattenSections(sections);
  const contentHash = createHash('sha256').update(plainText).digest('hex');

  // Insert contract row in DRAFT state
  const [created] = await db
    .insert(contracts)
    .values({
      profileId,
      templateId: input.templateId,
      title: input.title,
      status: 'DRAFT',
      provider: null,
      signedAssetKey: null,
      contentHash,
      sentAt: null,
      signedAt: null,
    })
    .returning();

  if (!created) {
    throw new DocumentsError('INTERNAL_ERROR', 'Failed to create contract');
  }

  return rowToContract(created);
}

/**
 * List all contracts for a profile (filtered by profileId).
 */
export async function listContracts(profileId: ProfileId): Promise<Contract[]> {
  const rows = await db
    .select()
    .from(contracts)
    .where(eq(contracts.profileId, profileId))
    .orderBy(contracts.createdAt);

  return rows.map(rowToContract);
}

/**
 * Get a single contract by ID (must belong to profileId).
 */
export async function getContract(
  profileId: ProfileId,
  contractId: string,
): Promise<Contract | null> {
  const [row] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.profileId, profileId)))
    .limit(1);

  return row ? rowToContract(row) : null;
}

/**
 * Generate contract PDF (always on-demand, never persisted until signed).
 * This is internal; used during send-for-signature and download flows.
 */
export async function generateContractPdfBuffer(
  contract: Contract,
  data: ContractData,
): Promise<Buffer> {
  const sections = renderTemplate(contract.templateId, data);
  const buffer = await generateContractPdf({
    title: contract.title,
    parties: [
      { name: data.party1.name, role: 'Party 1' },
      { name: data.party2.name, role: 'Party 2' },
    ],
    sections,
    contentHash: contract.contentHash || '',
    generatedDate: new Date().toISOString().slice(0, 10),
  });

  return buffer;
}

/**
 * Generate a branded summary PDF from a contract's stored metadata.
 *
 * The original ContractData (parties / amount) is not persisted — the contracts
 * table has no data column and Sprint C is migration-free — so the downloadable
 * document is a status + audit summary rather than the full original agreement.
 * It uses the same Rs.-safe generator (never the ₹ glyph) as the full contract.
 */
export async function generateContractSummaryPdf(contract: Contract): Promise<Buffer> {
  return generateContractPdf({
    title: contract.title,
    parties: [],
    sections: [
      {
        title: 'CONTRACT SUMMARY',
        content: [
          `Template: ${contract.templateId}`,
          `Status: ${contract.status}`,
          `E-sign provider: ${contract.provider ?? 'pending'}`,
        ],
      },
      {
        title: 'AUDIT',
        content: [
          `Content hash (SHA-256): ${contract.contentHash ?? 'n/a'}`,
          `Signed document key: ${contract.signedAssetKey ?? 'not signed yet'}`,
          'Generated from stored contract metadata.',
        ],
      },
    ],
    contentHash: contract.contentHash ?? '',
    generatedDate: new Date().toISOString().slice(0, 10),
  });
}

/**
 * Send contract for signature via the e-sign provider.
 * Mock: generates a fake signing session URL.
 * Real: throws "not configured" TODO (mirror aadhaar.ts).
 *
 * Atomic state transition: DRAFT → SENT, only if currently DRAFT.
 * Sets provider + sentAt atomically.
 */
export async function sendForSignature(
  profileId: ProfileId,
  contractId: string,
  provider: ESignProvider,
): Promise<{ signingUrl: string; sessionId: string }> {
  // Verify contract exists and belongs to this profile
  const contract = await getContract(profileId, contractId);
  if (!contract) {
    throw new DocumentsError('NOT_FOUND', 'Contract not found');
  }

  if (contract.status !== 'DRAFT') {
    throw new DocumentsError(
      'INVALID_STATE',
      `Contract must be in DRAFT status to send (current: ${contract.status})`,
    );
  }

  if (shouldUseMockEsign) {
    // Mock e-sign: generate fake session
    const sessionId = `MOCK-${randomUUID()}`;
    const signingUrl = `https://mock-esign.smartshaadi.co.in/sign/${sessionId}`;

    // Atomic transition: DRAFT → SENT
    const [updated] = await db
      .update(contracts)
      .set({
        status: 'SENT' as ContractStatus,
        provider,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contracts.id, contractId),
          eq(contracts.profileId, profileId),
          eq(contracts.status, 'DRAFT' as ContractStatus),
        ),
      )
      .returning();

    if (!updated) {
      throw new DocumentsError(
        'INVALID_STATE',
        'Contract state changed during update (concurrent request?)',
      );
    }

    return { signingUrl, sessionId };
  }

  // Real e-sign: not yet configured
  throw new DocumentsError(
    'NOT_CONFIGURED',
    'Real e-sign provider (DigiLocker/Signzy) not yet configured. TODO: implement with provider SDK.',
  );
}

/**
 * Complete the signature (mock callback — in real flow, e-sign provider POSTs this).
 * Stores the signed PDF to R2 (or mock R2 if shouldUseMockR2).
 *
 * Atomic state transition: SENT → SIGNED, only if currently SENT.
 * Sets signedAt + signedAssetKey atomically.
 */
export async function completeSignature(
  profileId: ProfileId,
  contractId: string,
): Promise<{ signedAssetKey: string; signedAt: Date }> {
  // Verify contract exists and is SENT
  const contract = await getContract(profileId, contractId);
  if (!contract) {
    throw new DocumentsError('NOT_FOUND', 'Contract not found');
  }

  if (contract.status !== 'SENT') {
    throw new DocumentsError(
      'INVALID_STATE',
      `Contract must be in SENT status to complete signature (current: ${contract.status})`,
    );
  }

  // In production the e-sign provider POSTs the signed PDF and we download+store
  // it here. The mock flow synthesizes only the R2 key (nothing is uploaded).
  const r2Key = `contracts/${profileId}/${contractId}-signed.pdf`;

  if (shouldUseMockR2) {
    // Mock storage — URL is synthesized, not actually stored
    // (the storage service returns a /__mock-r2/ path in getPhotoUrl)
  } else {
    // Real R2: upload the buffer
    // For now, we'd call a presigned URL endpoint and PUT the buffer,
    // but that's beyond the scope of this unit. In practice, the provider
    // would POST the signed file here.
    // TODO: implement real R2 upload flow (presigned PUT URL).
  }

  const signedAt = new Date();

  // Atomic transition: SENT → SIGNED
  const [updated] = await db
    .update(contracts)
    .set({
      status: 'SIGNED' as ContractStatus,
      signedAssetKey: r2Key,
      signedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contracts.id, contractId),
        eq(contracts.profileId, profileId),
        eq(contracts.status, 'SENT' as ContractStatus),
      ),
    )
    .returning();

  if (!updated) {
    throw new DocumentsError(
      'INVALID_STATE',
      'Contract state changed during update (concurrent request?)',
    );
  }

  return { signedAssetKey: r2Key, signedAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Type converters

function rowToContract(row: typeof contracts.$inferSelect): Contract {
  return {
    id: row.id,
    profileId: asProfileId(row.profileId),
    templateId: row.templateId,
    title: row.title,
    status: row.status as ContractStatus,
    provider: (row.provider as ESignProvider | null) ?? null,
    signedAssetKey: row.signedAssetKey ?? null,
    contentHash: row.contentHash ?? null,
    sentAt: row.sentAt ? (row.sentAt instanceof Date ? row.sentAt.toISOString() : row.sentAt) : null,
    signedAt: row.signedAt ? (row.signedAt instanceof Date ? row.signedAt.toISOString() : row.signedAt) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}
