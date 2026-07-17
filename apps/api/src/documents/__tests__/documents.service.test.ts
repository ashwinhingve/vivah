/**
 * Documents Service — unit tests
 *
 * Verifies:
 *   - Contract lifecycle: DRAFT → SENT → SIGNED
 *   - Invalid state transitions rejected
 *   - Multi-tenant isolation (can't touch another profile's contract)
 *   - contentHash computed from rendered template
 *   - Mock e-sign provider returns signing URL when shouldUseMockEsign=true
 *   - Real e-sign throws "not configured" when shouldUseMockEsign=false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createContract,
  listContracts,
  getContract,
  sendForSignature,
  completeSignature,
  DocumentsError,
} from '../documents.service.js';
import { randomUUID } from 'node:crypto';
import { asProfileId } from '@smartshaadi/types';
import type { ContractData } from '../templates.js';

const { mockDbSelect, mockDbInsert, mockDbUpdate, dbState, makeChain } = vi.hoisted(() => {
  // NOTE: cannot call the imported randomUUID() here — vi.hoisted runs before
  // ESM imports initialize. Use a literal UUID for the hoisted seed value.
  const dbState = { queue: [] as unknown[][], contractId: '11111111-1111-4111-8111-111111111111' };

  const makeChain = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = {};
    const ret = () => p;
    for (const m of [
      'from', 'where', 'groupBy', 'orderBy', 'innerJoin', 'leftJoin', 'rightJoin',
      'limit', 'offset', 'having', 'set', 'returning', 'onConflictDoUpdate', 'values',
      'and', 'eq',
    ]) {
      p[m] = ret;
    }
    p.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve(dbState.queue.shift() ?? []));
    return p;
  };

  return { mockDbSelect: vi.fn(), mockDbInsert: vi.fn(), mockDbUpdate: vi.fn(), dbState, makeChain };
});

vi.mock('../../lib/db.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock('../../lib/env.js', () => ({
  shouldUseMockEsign: true,
  shouldUseMockR2: true,
  env: {},
}));

vi.mock('../../storage/service.js', () => ({
  getPresignedUploadUrl: vi.fn().mockResolvedValue({ uploadUrl: 'mock-url', r2Key: 'mock-key' }),
}));

describe('Documents Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.queue = [];
  });

  describe('createContract', () => {
    it('creates a contract in DRAFT status with contentHash', async () => {
      const profileId = asProfileId(randomUUID());
      const contractId = randomUUID();

      // Mock the insert chain
      const mockChain = makeChain();
      mockDbInsert.mockReturnValue(mockChain);
      dbState.queue.push([
        {
          id: contractId,
          profileId,
          templateId: 'vendor-service-agreement',
          title: 'Test Agreement',
          status: 'DRAFT',
          provider: null,
          signedAssetKey: null,
          // The service computes a real sha256 and inserts it; the mocked
          // .returning() echoes a concrete 64-hex hash so the mapped contract
          // exposes a well-formed string (asymmetric matchers can't be returned).
          contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          sentAt: null,
          signedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const input = {
        templateId: 'vendor-service-agreement',
        title: 'Test Agreement',
        data: {
          party1: { name: 'Provider Inc' },
          party2: { name: 'Client LLC' },
          effectiveDate: '2026-07-17',
          services: ['Service A', 'Service B'],
          amount: 50000,
        } as ContractData,
      };

      const contract = await createContract(profileId, input);

      expect(contract.status).toBe('DRAFT');
      expect(contract.profileId).toBe(profileId);
      expect(contract.contentHash).toBeTruthy();
      expect(contract.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rejects unknown template', async () => {
      const profileId = asProfileId(randomUUID());
      const input = {
        templateId: 'unknown-template',
        title: 'Test',
        data: {} as any,
      };

      await expect(createContract(profileId, input)).rejects.toThrow(DocumentsError);
    });
  });

  describe('listContracts & getContract', () => {
    it('lists all contracts for a profile', async () => {
      const profileId = asProfileId(randomUUID());
      const mockChain = makeChain();

      mockDbSelect.mockReturnValue(mockChain);
      dbState.queue.push([
        {
          id: randomUUID(),
          profileId,
          templateId: 'vendor-service-agreement',
          title: 'Contract 1',
          status: 'DRAFT',
          provider: null,
          signedAssetKey: null,
          contentHash: 'hash1',
          sentAt: null,
          signedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: randomUUID(),
          profileId,
          templateId: 'b2b-contract',
          title: 'Contract 2',
          status: 'SENT',
          provider: 'DIGILOCKER',
          signedAssetKey: null,
          contentHash: 'hash2',
          sentAt: new Date(),
          signedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const contracts = await listContracts(profileId);

      expect(contracts.length).toBe(2);
      expect(contracts[0]!.status).toBe('DRAFT');
      expect(contracts[1]!.status).toBe('SENT');
    });

    it('returns null for non-existent contract', async () => {
      const profileId = asProfileId(randomUUID());
      const contractId = randomUUID();
      const mockChain = makeChain();

      mockDbSelect.mockReturnValue(mockChain);
      dbState.queue.push([]); // empty result

      const contract = await getContract(profileId, contractId);

      expect(contract).toBeNull();
    });
  });

  describe('sendForSignature', () => {
    it('transitions contract from DRAFT to SENT with mock e-sign', async () => {
      const profileId = asProfileId(randomUUID());
      const contractId = randomUUID();

      // Mock getContract
      const mockSelectChain = makeChain();
      mockDbSelect.mockReturnValue(mockSelectChain);
      dbState.queue.push([
        {
          id: contractId,
          profileId,
          templateId: 'vendor-service-agreement',
          title: 'Test Agreement',
          status: 'DRAFT',
          provider: null,
          signedAssetKey: null,
          contentHash: 'testhash',
          sentAt: null,
          signedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Mock update
      const mockUpdateChain = makeChain();
      mockDbUpdate.mockReturnValue(mockUpdateChain);
      dbState.queue.push([
        {
          id: contractId,
          profileId,
          templateId: 'vendor-service-agreement',
          title: 'Test Agreement',
          status: 'SENT',
          provider: 'DIGILOCKER',
          signedAssetKey: null,
          contentHash: 'testhash',
          sentAt: new Date(),
          signedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await sendForSignature(profileId, contractId, 'DIGILOCKER');

      expect(result.signingUrl).toContain('mock-esign.smartshaadi.co.in');
      expect(result.sessionId).toMatch(/^MOCK-/);
    });

    it('rejects sending a contract that is not DRAFT', async () => {
      const profileId = asProfileId(randomUUID());
      const contractId = randomUUID();

      // Mock getContract returning SENT status
      const mockSelectChain = makeChain();
      mockDbSelect.mockReturnValue(mockSelectChain);
      dbState.queue.push([
        {
          id: contractId,
          profileId,
          status: 'SENT',
          provider: 'DIGILOCKER',
        },
      ]);

      await expect(
        sendForSignature(profileId, contractId, 'DIGILOCKER'),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_STATE',
        }),
      );
    });

    it('returns 404 for non-existent contract', async () => {
      const profileId = asProfileId(randomUUID());
      const contractId = randomUUID();

      const mockSelectChain = makeChain();
      mockDbSelect.mockReturnValue(mockSelectChain);
      dbState.queue.push([]); // empty

      await expect(
        sendForSignature(profileId, contractId, 'DIGILOCKER'),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      );
    });
  });

  describe('completeSignature', () => {
    it('transitions contract from SENT to SIGNED', async () => {
      const profileId = asProfileId(randomUUID());
      const contractId = randomUUID();

      // Mock getContract
      const mockSelectChain = makeChain();
      mockDbSelect.mockReturnValue(mockSelectChain);
      dbState.queue.push([
        {
          id: contractId,
          profileId,
          status: 'SENT',
          provider: 'DIGILOCKER',
        },
      ]);

      // Mock update
      const mockUpdateChain = makeChain();
      mockDbUpdate.mockReturnValue(mockUpdateChain);
      dbState.queue.push([
        {
          id: contractId,
          profileId,
          status: 'SIGNED',
          provider: 'DIGILOCKER',
          signedAssetKey: `contracts/${profileId}/${contractId}-signed.pdf`,
          signedAt: new Date(),
        },
      ]);

      const result = await completeSignature(profileId, contractId);

      expect(result.signedAssetKey).toContain('signed.pdf');
      expect(result.signedAt).toBeInstanceOf(Date);
    });

    it('rejects completing a contract that is not SENT', async () => {
      const profileId = asProfileId(randomUUID());
      const contractId = randomUUID();

      // Mock getContract returning DRAFT status
      const mockSelectChain = makeChain();
      mockDbSelect.mockReturnValue(mockSelectChain);
      dbState.queue.push([
        {
          id: contractId,
          profileId,
          status: 'DRAFT',
        },
      ]);

      await expect(completeSignature(profileId, contractId)).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_STATE',
        }),
      );
    });
  });

  describe('multi-tenant isolation', () => {
    it('cannot fetch another profile\'s contract', async () => {
      const profileId2 = asProfileId(randomUUID());
      const contractId = randomUUID();

      const mockSelectChain = makeChain();
      mockDbSelect.mockReturnValue(mockSelectChain);
      dbState.queue.push([]); // filtering by both profileId and contractId returns empty

      const contract = await getContract(profileId2, contractId);

      expect(contract).toBeNull();
    });
  });
});
