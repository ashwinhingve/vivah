/**
 * Smart Shaadi — Vendor Approval Service Tests (P1-8)
 * Covers: submit / startReview / approve / reject / suspend / reinstate
 *         + CAS concurrent-loser handling, validation, audit + notify dispatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate },
}));

vi.mock('@smartshaadi/db', () => ({
  vendors: {
    id:                'vendors.id',
    userId:            'vendors.userId',
    businessName:      'vendors.businessName',
    category:          'vendors.category',
    city:              'vendors.city',
    phone:             'vendors.phone',
    status:            'vendors.status',
    submittedAt:       'vendors.submittedAt',
    reviewedAt:        'vendors.reviewedAt',
    reviewedByUserId:  'vendors.reviewedByUserId',
    rejectionReason:   'vendors.rejectionReason',
    rejectionCategory: 'vendors.rejectionCategory',
  },
  vendorStatusEnum: {
    enumValues: ['DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'],
  },
  rejectionCategoryEnum: {
    enumValues: ['INCOMPLETE_DOCS', 'POLICY_VIOLATION', 'IDENTITY_CONCERN', 'OTHER'],
  },
}));

vi.mock('drizzle-orm', () => ({
  eq:  vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

const mockAppendAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('../../payments/service.js', () => ({
  appendAuditLog: mockAppendAuditLog,
}));

const mockNotificationsAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
vi.mock('../../infrastructure/redis/queues.js', () => ({
  notificationsQueue: { add: mockNotificationsAdd },
}));

// ── DB chain helpers ─────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

function makeSelect(resolveWith: unknown[]) {
  const chain: AnyRecord = {
    then(onfulfilled: ((v: unknown) => unknown) | null | undefined) {
      return Promise.resolve(resolveWith).then(onfulfilled ?? undefined);
    },
  };
  chain['from']  = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockReturnValue(chain);
  return vi.fn().mockReturnValue(chain);
}

function makeUpdate(returningRows: unknown[] = []) {
  const chain: AnyRecord = {
    then(onfulfilled: ((v: unknown) => unknown) | null | undefined) {
      return Promise.resolve(returningRows).then(onfulfilled ?? undefined);
    },
  };
  chain['set']       = vi.fn().mockReturnValue(chain);
  chain['where']     = vi.fn().mockReturnValue(chain);
  chain['returning'] = vi.fn().mockResolvedValue(returningRows);
  return vi.fn().mockReturnValue(chain);
}

const COMPLETE_VENDOR = {
  id:           'vendor-1',
  userId:       'user-vendor-1',
  businessName: 'Camera Co',
  category:     'PHOTOGRAPHY',
  city:         'Pune',
  phone:        '+919876543210',
  status:       'DRAFT' as const,
};

const APPROVED_VENDOR = { ...COMPLETE_VENDOR, status: 'APPROVED' as const };

beforeEach(() => {
  vi.clearAllMocks();
  mockAppendAuditLog.mockResolvedValue(undefined);
  mockNotificationsAdd.mockResolvedValue({ id: 'job-1' });
});

// ── submitForReview ──────────────────────────────────────────────────────────

describe('submitForReview', () => {
  it('transitions DRAFT → PENDING and fires audit + notification', async () => {
    const { submitForReview } = await import('../approval.service.js');
    mockDbSelect.mockImplementation(makeSelect([COMPLETE_VENDOR]));
    mockDbUpdate.mockImplementation(makeUpdate([{ ...COMPLETE_VENDOR, status: 'PENDING' }]));

    const updated = await submitForReview('vendor-1');

    expect(updated.status).toBe('PENDING');
    expect(mockAppendAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType:  'VENDOR_SUBMITTED',
      entityType: 'vendor',
      entityId:   'vendor-1',
      actorId:    'user-vendor-1',
    }));
    expect(mockNotificationsAdd).toHaveBeenCalledWith('VENDOR_SUBMITTED', expect.objectContaining({
      userId: 'user-vendor-1',
      type:   'VENDOR_SUBMITTED',
    }));
  });

  it('rejects when required fields are missing (INCOMPLETE_PROFILE)', async () => {
    const { submitForReview, VendorApprovalError } = await import('../approval.service.js');
    const incomplete = { ...COMPLETE_VENDOR, businessName: '', phone: '' };
    mockDbSelect.mockImplementation(makeSelect([incomplete]));

    await expect(submitForReview('vendor-1')).rejects.toBeInstanceOf(VendorApprovalError);
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockAppendAuditLog).not.toHaveBeenCalled();
  });

  it('rejects when vendor does not exist (VENDOR_NOT_FOUND)', async () => {
    const { submitForReview, VendorApprovalError } = await import('../approval.service.js');
    mockDbSelect.mockImplementation(makeSelect([]));

    await expect(submitForReview('ghost')).rejects.toBeInstanceOf(VendorApprovalError);
  });
});

// ── startReview / approve / reject (UNDER_REVIEW transitions) ────────────────

describe('startReview', () => {
  it('transitions PENDING → UNDER_REVIEW', async () => {
    const { startReview } = await import('../approval.service.js');
    mockDbUpdate.mockImplementation(makeUpdate([{ ...COMPLETE_VENDOR, status: 'UNDER_REVIEW', reviewedByUserId: 'admin-1' }]));

    const updated = await startReview('admin-1', 'vendor-1');

    expect(updated.status).toBe('UNDER_REVIEW');
    expect(mockAppendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'VENDOR_UNDER_REVIEW' }));
  });

  it('throws STATUS_CHANGED_CONCURRENTLY when another admin already claimed', async () => {
    const { startReview, VendorApprovalError } = await import('../approval.service.js');
    mockDbUpdate.mockImplementation(makeUpdate([])); // CAS loser

    await expect(startReview('admin-2', 'vendor-1')).rejects.toBeInstanceOf(VendorApprovalError);
    await expect(startReview('admin-2', 'vendor-1')).rejects.toMatchObject({ code: 'STATUS_CHANGED_CONCURRENTLY' });
    expect(mockAppendAuditLog).not.toHaveBeenCalled();
  });
});

describe('approve', () => {
  it('transitions UNDER_REVIEW → APPROVED + audit + notify', async () => {
    const { approve } = await import('../approval.service.js');
    mockDbUpdate.mockImplementation(makeUpdate([{ ...APPROVED_VENDOR, reviewedByUserId: 'admin-1' }]));

    const updated = await approve('admin-1', 'vendor-1');

    expect(updated.status).toBe('APPROVED');
    expect(mockAppendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'VENDOR_APPROVED' }));
    expect(mockNotificationsAdd).toHaveBeenCalledWith('VENDOR_APPROVED', expect.any(Object));
  });
});

describe('reject', () => {
  it('requires reason of at least 10 characters', async () => {
    const { reject, VendorApprovalError } = await import('../approval.service.js');

    await expect(reject('admin-1', 'vendor-1', 'too short', 'OTHER')).rejects.toBeInstanceOf(VendorApprovalError);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('transitions UNDER_REVIEW → REJECTED with reason + category', async () => {
    const { reject } = await import('../approval.service.js');
    mockDbUpdate.mockImplementation(makeUpdate([{ ...COMPLETE_VENDOR, status: 'REJECTED', rejectionReason: 'Missing GST certificate', rejectionCategory: 'INCOMPLETE_DOCS' }]));

    const updated = await reject('admin-1', 'vendor-1', 'Missing GST certificate', 'INCOMPLETE_DOCS');

    expect(updated.status).toBe('REJECTED');
    expect(mockAppendAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'VENDOR_REJECTED',
      payload:   expect.objectContaining({ category: 'INCOMPLETE_DOCS' }),
    }));
  });
});

describe('suspend / reinstate', () => {
  it('suspend: APPROVED → SUSPENDED with reason', async () => {
    const { suspend } = await import('../approval.service.js');
    mockDbUpdate.mockImplementation(makeUpdate([{ ...APPROVED_VENDOR, status: 'SUSPENDED' }]));

    const updated = await suspend('admin-1', 'vendor-1', 'Policy violation detected during audit');

    expect(updated.status).toBe('SUSPENDED');
    expect(mockAppendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'VENDOR_SUSPENDED' }));
  });

  it('suspend rejects short reasons', async () => {
    const { suspend, VendorApprovalError } = await import('../approval.service.js');

    await expect(suspend('admin-1', 'vendor-1', 'spam')).rejects.toBeInstanceOf(VendorApprovalError);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('reinstate: SUSPENDED → APPROVED', async () => {
    const { reinstate } = await import('../approval.service.js');
    mockDbUpdate.mockImplementation(makeUpdate([APPROVED_VENDOR]));

    const updated = await reinstate('admin-1', 'vendor-1');

    expect(updated.status).toBe('APPROVED');
    expect(mockAppendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'VENDOR_REINSTATED' }));
  });
});
