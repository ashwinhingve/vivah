import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../rekognition.js', () => ({
  compareFaces: vi.fn(),
}));

const selectResults: unknown[][] = [];

function pushResult(rows: unknown[]): void {
  selectResults.push(rows);
}

vi.mock('../../lib/db.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue([]) })),
    })),
    select: vi.fn(() => {
      const rows = selectResults.shift() ?? [];
      const terminal = Promise.resolve(rows);
      const chain: Record<string, unknown> = {
        from:    vi.fn(() => chain),
        where:   vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit:   vi.fn(() => terminal),
        then:    terminal.then.bind(terminal),
      };
      return chain;
    }),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
}));

import { hashPhone, checkForDuplicates } from '../duplicateCheck.js';
import { compareFaces } from '../rekognition.js';

beforeEach(() => {
  vi.clearAllMocks();
  selectResults.length = 0;
});

describe('hashPhone', () => {
  it('produces stable SHA-256 hex digest, whitespace insensitive', () => {
    expect(hashPhone('+91 9999999999')).toBe(hashPhone('+919999999999'));
    expect(hashPhone('a')).not.toBe(hashPhone('b'));
    expect(hashPhone('a')).toHaveLength(64);
  });
});

describe('checkForDuplicates', () => {
  it('flags duplicate on phone hash collision', async () => {
    pushResult([{ userId: 'OTHER' }]);     // phone hits
    pushResult([]);                         // existing kyc lookup for merge
    const result = await checkForDuplicates({
      userId: 'U1', profileId: 'P1', phone: '+919999999999',
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.matchedUserIds).toContain('OTHER');
    expect(result.reason).toMatch(/phone hash matches/);
  });

  it('flags duplicate on aadhaar ref collision', async () => {
    pushResult([{ profileId: 'OTHER_PROFILE' }]); // aadhaar hits
    pushResult([{ userId: 'OWNER' }]);            // profile lookup
    pushResult([]);                                // existing kyc lookup for merge
    const result = await checkForDuplicates({
      userId: 'U1', profileId: 'P1', aadhaarRefId: 'AAD123',
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.matchedUserIds).toContain('OWNER');
    expect(result.reason).toMatch(/Aadhaar ref matches/);
  });

  it('flags duplicate when face similarity exceeds threshold', async () => {
    pushResult([{ userId: 'OTHER', selfieR2Key: 'kyc/o.jpg' }]); // face pool
    pushResult([]); // existing kyc lookup for merge
    vi.mocked(compareFaces).mockResolvedValue(0.97);
    const result = await checkForDuplicates({
      userId: 'U1', profileId: 'P1', selfieR2Key: 'kyc/u1.jpg',
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.similarityScore).toBe(0.97);
    expect(result.matchedUserIds).toContain('OTHER');
  });

  it('does NOT flag when face similarity is below threshold', async () => {
    pushResult([{ userId: 'OTHER', selfieR2Key: 'kyc/o.jpg' }]); // face pool
    vi.mocked(compareFaces).mockResolvedValue(0.80);
    const result = await checkForDuplicates({
      userId: 'U1', profileId: 'P1', selfieR2Key: 'kyc/u1.jpg',
    });
    expect(result.isDuplicate).toBe(false);
    expect(result.matchedUserIds).toEqual([]);
  });

  it('returns clean result when no signals match', async () => {
    pushResult([]); // phone
    pushResult([]); // aadhaar
    const result = await checkForDuplicates({
      userId: 'U1', profileId: 'P1', phone: '+919999999999', aadhaarRefId: 'AAD',
    });
    expect(result.isDuplicate).toBe(false);
    expect(result.reason).toBeNull();
  });
});
