/**
 * Smart Shaadi — B2B Self-Serve Service
 *
 * Business logic for B2B account creation, contract lifecycle, and invoice generation.
 * All amounts in phase5 tables are stored as `bigint` PAISE; legacy invoices use
 * `decimal(12,2)` RUPEES. Conversions explicit via rupeesToPaise/paiseToRupees.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { b2bAccounts, contracts } from '@smartshaadi/db';
import type { B2BAccount, Contract, ProfileId } from '@smartshaadi/types';
import { asProfileId } from '@smartshaadi/types';
import type { CreateB2BAccountInput, UpdateB2BAccountInput, CreateContractInput, SendContractInput } from '@smartshaadi/schemas';

export class B2BError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'B2BError';
  }
}

/**
 * Create a new B2B account for an authenticated user.
 * GSTIN must be unique. Scoped by profileId.
 */
export async function createB2BAccount(
  profileId: ProfileId,
  input: CreateB2BAccountInput,
): Promise<B2BAccount> {
  // Validate input profileId matches input.profileId
  if (input.profileId !== profileId) {
    throw new B2BError('FORBIDDEN', 'Profile ID mismatch');
  }

  // Check for existing account with same GSTIN
  const existing = await db
    .select({ id: b2bAccounts.id })
    .from(b2bAccounts)
    .where(eq(b2bAccounts.gstin, input.gstin))
    .limit(1);

  if (existing.length > 0) {
    throw new B2BError('CONFLICT', 'GSTIN already registered');
  }

  // Create new account
  const [created] = await db
    .insert(b2bAccounts)
    .values({
      profileId,
      legalName: input.legalName,
      gstin: input.gstin,
      hsnSac: input.hsnSac || null,
      billingAddress: input.billingAddress || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      status: 'PENDING',
    })
    .returning();

  if (!created) throw new B2BError('INTERNAL_ERROR', 'Failed to create B2B account');

  return rowToB2BAccount(created);
}

/**
 * Get a B2B account by ID. Must belong to the given profileId.
 */
export async function getB2BAccount(
  profileId: ProfileId,
  accountId: string,
): Promise<B2BAccount | null> {
  const [row] = await db
    .select()
    .from(b2bAccounts)
    .where(and(eq(b2bAccounts.id, accountId), eq(b2bAccounts.profileId, profileId)))
    .limit(1);

  return row ? rowToB2BAccount(row) : null;
}

/**
 * List all B2B accounts for a given profileId.
 */
export async function listB2BAccounts(profileId: ProfileId): Promise<B2BAccount[]> {
  const rows = await db
    .select()
    .from(b2bAccounts)
    .where(eq(b2bAccounts.profileId, profileId));

  return rows.map(rowToB2BAccount);
}

/**
 * Update a B2B account. Must belong to the given profileId.
 */
export async function updateB2BAccount(
  profileId: ProfileId,
  accountId: string,
  input: UpdateB2BAccountInput,
): Promise<B2BAccount> {
  // Check ownership
  const [existing] = await db
    .select()
    .from(b2bAccounts)
    .where(and(eq(b2bAccounts.id, accountId), eq(b2bAccounts.profileId, profileId)))
    .limit(1);

  if (!existing) {
    throw new B2BError('NOT_FOUND', 'B2B account not found');
  }

  const values: Record<string, unknown> = {};
  if (input.legalName !== undefined) values.legalName = input.legalName;
  if (input.hsnSac !== undefined) values.hsnSac = input.hsnSac;
  if (input.billingAddress !== undefined) values.billingAddress = input.billingAddress;
  if (input.contactEmail !== undefined) values.contactEmail = input.contactEmail;
  if (input.contactPhone !== undefined) values.contactPhone = input.contactPhone;
  if (input.status !== undefined) values.status = input.status;
  values.updatedAt = new Date();

  const [updated] = await db
    .update(b2bAccounts)
    .set(values)
    .where(eq(b2bAccounts.id, accountId))
    .returning();

  if (!updated) throw new B2BError('INTERNAL_ERROR', 'Failed to update B2B account');

  return rowToB2BAccount(updated);
}

/**
 * Create a new contract. Scoped by profileId.
 */
export async function createContract(
  profileId: ProfileId,
  input: CreateContractInput,
): Promise<Contract> {
  if (input.profileId !== profileId) {
    throw new B2BError('FORBIDDEN', 'Profile ID mismatch');
  }

  const [created] = await db
    .insert(contracts)
    .values({
      profileId,
      templateId: input.templateId,
      title: input.title,
      status: 'DRAFT',
    })
    .returning();

  if (!created) throw new B2BError('INTERNAL_ERROR', 'Failed to create contract');

  return rowToContract(created);
}

/**
 * Get a contract by ID. Must belong to the given profileId.
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
 * List all contracts for a given profileId.
 */
export async function listContracts(profileId: ProfileId): Promise<Contract[]> {
  const rows = await db
    .select()
    .from(contracts)
    .where(eq(contracts.profileId, profileId));

  return rows.map(rowToContract);
}

/**
 * Send a contract for e-signing (transition DRAFT → SENT).
 * Stubs the e-sign provider call; real integration in Phase 2.
 */
export async function sendContract(
  profileId: ProfileId,
  contractId: string,
  input: SendContractInput,
): Promise<Contract> {
  const existing = await getContract(profileId, contractId);
  if (!existing) {
    throw new B2BError('NOT_FOUND', 'Contract not found');
  }

  if (existing.status !== 'DRAFT') {
    throw new B2BError('INVALID_STATE', 'Contract must be in DRAFT status to send');
  }

  // STUB: real e-sign provider call would go here
  // For now, just set the status and provider
  const now = new Date();
  const [updated] = await db
    .update(contracts)
    .set({
      status: 'SENT',
      provider: input.provider,
      sentAt: now,
      updatedAt: now,
    })
    .where(eq(contracts.id, contractId))
    .returning();

  if (!updated) throw new B2BError('INTERNAL_ERROR', 'Failed to send contract');

  return rowToContract(updated);
}

/**
 * Helper: convert DB row to B2BAccount type
 */
function rowToB2BAccount(row: typeof b2bAccounts.$inferSelect): B2BAccount {
  return {
    id: row.id,
    profileId: asProfileId(row.profileId),
    legalName: row.legalName,
    gstin: row.gstin,
    hsnSac: row.hsnSac,
    billingAddress: row.billingAddress,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Helper: convert DB row to Contract type
 */
function rowToContract(row: typeof contracts.$inferSelect): Contract {
  return {
    id: row.id,
    profileId: asProfileId(row.profileId),
    templateId: row.templateId,
    title: row.title,
    status: row.status,
    provider: row.provider,
    signedAssetKey: row.signedAssetKey,
    contentHash: row.contentHash,
    sentAt: row.sentAt?.toISOString() ?? null,
    signedAt: row.signedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
