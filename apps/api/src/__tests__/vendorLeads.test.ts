/**
 * Vendor Leads API tests — Tier 3 Track 2.
 *
 * Covers: create, list, qualify (wallet debit), refund. Better Auth, db,
 * wallet, and lib/profile are all mocked. The service layer is unit-tested
 * via supertest against the real router.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

const {
  mockGetSession,
  mockCreateLead,
  mockMarkLeadQualified,
  mockRefundLead,
  mockGetVendorLeads,
  mockGetVendorLeadStats,
  mockSelect,
} = vi.hoisted(() => ({
  mockGetSession:         vi.fn(),
  mockCreateLead:         vi.fn(),
  mockMarkLeadQualified:  vi.fn(),
  mockRefundLead:         vi.fn(),
  mockGetVendorLeads:     vi.fn(),
  mockGetVendorLeadStats: vi.fn(),
  mockSelect:             vi.fn(),
}));

vi.mock('../auth/config.js', () => ({
  auth: {
    handler: vi.fn((_req: Request, res: Response) => { res.json({ success: true }); }),
    api: { getSession: mockGetSession },
  },
}));

vi.mock('better-auth/node', () => ({
  toNodeHandler: (authObj: { handler: (req: Request, res: Response) => void }) =>
    (req: Request, res: Response) => authObj.handler(req, res),
  fromNodeHeaders: vi.fn((h: Record<string, string>) => h),
}));

vi.mock('../auth/lastActive.js', () => ({ pingLastActive: vi.fn() }));

vi.mock('../services/vendorLeadService.js', async () => {
  const actual = await vi.importActual<typeof import('../services/vendorLeadService.js')>(
    '../services/vendorLeadService.js',
  );
  return {
    ...actual,
    createLead:         mockCreateLead,
    markLeadQualified:  mockMarkLeadQualified,
    refundLead:         mockRefundLead,
    getVendorLeads:     mockGetVendorLeads,
    getVendorLeadStats: mockGetVendorLeadStats,
  };
});

// The /my and /stats handlers each run a `db.select(...).from(vendors).where(...).limit(1)`
// to resolve req.user.id → vendors.id. Mock the chain to return a vendor row.
vi.mock('../lib/db.js', () => ({
  db: {
    select: mockSelect,
  },
}));

import { vendorLeadsRouter, vendorLeadsAdminRouter } from '../routes/vendorLeads.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/vendor-leads', vendorLeadsRouter);
  app.use('/api/v1/admin',        vendorLeadsAdminRouter);
  return app;
}

const VENDOR_ROW_ID = '550e8400-e29b-41d4-a716-446655440002';
const LEAD_ID       = '550e8400-e29b-41d4-a716-446655440003';
const VENDOR_ID     = '550e8400-e29b-41d4-a716-446655440004';

const CUSTOMER_USER = {
  id: 'user_customer',
  name: 'Customer User',
  email: 'c@example.com',
  role: 'INDIVIDUAL',
  status: 'ACTIVE',
  phoneNumber: '+919999900001',
};
const VENDOR_USER = {
  id: 'user_vendor',
  name: 'Vendor User',
  email: 'v@example.com',
  role: 'VENDOR',
  status: 'ACTIVE',
  phoneNumber: '+919999900002',
};
const ADMIN_USER = {
  id: 'user_admin',
  name: 'Admin User',
  email: 'a@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  phoneNumber: '+919999900003',
};

function chain(returnRows: unknown[]) {
  // Mirrors the drizzle fluent API chain used by resolveOwnedVendor:
  //   db.select(...).from(vendors).where(...).limit(1)
  return {
    from:  vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(returnRows),
      }),
    }),
  };
}

describe('Vendor Leads API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chain([{ id: VENDOR_ROW_ID }]));
  });

  it('POST /api/v1/vendor-leads creates a lead for an authenticated customer', async () => {
    mockGetSession.mockResolvedValueOnce({ user: CUSTOMER_USER, session: {} });
    mockCreateLead.mockResolvedValueOnce({
      id: LEAD_ID, vendorId: VENDOR_ID, inquirerUserId: CUSTOMER_USER.id,
      eventType: 'WEDDING', feeChargedInr: 100, feeStatus: 'PENDING',
    });

    const res = await request(buildApp())
      .post('/api/v1/vendor-leads')
      .send({
        vendor_id:  VENDOR_ID,
        event_type: 'WEDDING',
        message:    'Looking for photographer for Jan 2027 wedding',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lead.id).toBe(LEAD_ID);
    expect(mockCreateLead).toHaveBeenCalledWith(expect.objectContaining({
      vendorId:       VENDOR_ID,
      inquirerUserId: CUSTOMER_USER.id,
      eventType:      'WEDDING',
    }));
  });

  it('GET /api/v1/vendor-leads/my returns vendor inbox filtered by status', async () => {
    mockGetSession.mockResolvedValueOnce({ user: VENDOR_USER, session: {} });
    mockGetVendorLeads.mockResolvedValueOnce([
      { id: LEAD_ID, vendorId: VENDOR_ROW_ID, feeStatus: 'CHARGED', eventType: 'CORPORATE' },
    ]);

    const res = await request(buildApp())
      .get('/api/v1/vendor-leads/my?status=CHARGED&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.data.leads).toHaveLength(1);
    expect(mockGetVendorLeads).toHaveBeenCalledWith(VENDOR_ROW_ID, expect.objectContaining({
      status: 'CHARGED', limit: 10,
    }));
  });

  it('PATCH /api/v1/admin/vendor-leads/:id qualify debits via service and returns lead', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    mockMarkLeadQualified.mockResolvedValueOnce({
      id: LEAD_ID, feeStatus: 'CHARGED', leadQuality: 'HIGH',
      chargedAt: new Date().toISOString(),
    });

    const res = await request(buildApp())
      .patch(`/api/v1/admin/vendor-leads/${LEAD_ID}`)
      .send({ action: 'qualify', quality: 'HIGH' });

    expect(res.status).toBe(200);
    expect(res.body.data.lead.feeStatus).toBe('CHARGED');
    expect(mockMarkLeadQualified).toHaveBeenCalledWith(LEAD_ID, 'HIGH');
  });

  it('PATCH /api/v1/admin/vendor-leads/:id refund delegates to service with reason', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    mockRefundLead.mockResolvedValueOnce({
      id: LEAD_ID, feeStatus: 'REFUNDED', refundReason: 'Customer complained — duplicate',
    });

    const res = await request(buildApp())
      .patch(`/api/v1/admin/vendor-leads/${LEAD_ID}`)
      .send({ action: 'refund', reason: 'Customer complained — duplicate' });

    expect(res.status).toBe(200);
    expect(res.body.data.lead.feeStatus).toBe('REFUNDED');
    expect(mockRefundLead).toHaveBeenCalledWith(LEAD_ID, 'Customer complained — duplicate');
  });
});
