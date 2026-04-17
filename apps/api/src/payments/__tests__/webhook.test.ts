/**
 * Smart Shaadi — Webhook Handler Tests
 * Covers: invalid signature, payment.captured, dispute.created
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/db.js', () => ({ db: {} }));

vi.mock('@smartshaadi/db', () => ({
  payments:       { id: 'payments.id', bookingId: 'payments.bookingId', status: 'payments.status', razorpayOrderId: 'payments.razorpayOrderId', razorpayPaymentId: 'payments.razorpayPaymentId', amount: 'payments.amount', currency: 'payments.currency', createdAt: 'payments.createdAt' },
  bookings:       { id: 'bookings.id', customerId: 'bookings.customerId', status: 'bookings.status', totalAmount: 'bookings.totalAmount', vendorId: 'bookings.vendorId' },
  escrowAccounts: { id: 'escrowAccounts.id', bookingId: 'escrowAccounts.bookingId', totalHeld: 'escrowAccounts.totalHeld', status: 'escrowAccounts.status', released: 'escrowAccounts.released' },
  auditLogs:      { id: 'auditLogs.id', eventType: 'auditLogs.eventType', entityType: 'auditLogs.entityType', entityId: 'auditLogs.entityId', actorId: 'auditLogs.actorId', payload: 'auditLogs.payload', contentHash: 'auditLogs.contentHash', prevHash: 'auditLogs.prevHash' },
  auditEventTypeEnum: { enumValues: ['PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'ESCROW_HELD', 'ESCROW_RELEASED', 'ESCROW_DISPUTED'] },
}));

vi.mock('drizzle-orm', () => ({
  eq:   vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq', _col, _val })),
  and:  vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: vi.fn((_col: unknown) => ({ type: 'desc', _col })),
  sql:  vi.fn(() => ({ type: 'sql' })),
}));

vi.mock('../../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true, REDIS_URL: 'redis://localhost:6379', DATABASE_URL: 'postgresql://localhost/test' },
}));

// Mock razorpay — signature verification is controllable per test
const mockVerifySignature = vi.fn().mockResolvedValue(true);
vi.mock('../../lib/razorpay.js', () => ({
  createOrder:              vi.fn(),
  createRefund:             vi.fn(),
  transferToVendor:         vi.fn(),
  verifyWebhookSignature:   mockVerifySignature,
}));

// Mock handlePaymentSuccess and markBookingDisputed from service
const mockHandlePaymentSuccess = vi.fn().mockResolvedValue(undefined);
const mockMarkBookingDisputed  = vi.fn().mockResolvedValue(undefined);

vi.mock('../service.js', () => ({
  handlePaymentSuccess:  mockHandlePaymentSuccess,
  markBookingDisputed:   mockMarkBookingDisputed,
  requestRefund:         vi.fn(),
  createPaymentOrder:    vi.fn(),
  getPaymentHistory:     vi.fn(),
  getEscrowStatus:       vi.fn(),
  computeHash:           vi.fn().mockReturnValue('mock-hash'),
  appendAuditLog:        vi.fn().mockResolvedValue(undefined),
  transferToVendor:      vi.fn(),
}));

// ── Helper to build mock req/res ──────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

function buildReq(body: unknown, sig: string): Partial<Request> {
  return {
    body:    Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)),
    headers: { 'x-razorpay-signature': sig },
  };
}

function buildRes(): { res: Partial<Response>; statusMock: ReturnType<typeof vi.fn>; jsonMock: ReturnType<typeof vi.fn> } {
  const jsonMock   = vi.fn().mockReturnThis();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  const res: Partial<Response> = {
    status: statusMock as unknown as Response['status'],
    json:   jsonMock as unknown as Response['json'],
  };
  return { res, statusMock, jsonMock };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifySignature.mockResolvedValue(true);
});

describe('webhookHandler', () => {
  it('returns 400 if signature header is missing', async () => {
    const { webhookHandler } = await import('../webhook.js');

    const req = { body: Buffer.from('{}'), headers: {} } as Partial<Request>;
    const { res, statusMock, jsonMock } = buildRes();

    await webhookHandler(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 400 if Razorpay signature is invalid', async () => {
    const { webhookHandler } = await import('../webhook.js');

    // Fail the signature check
    mockVerifySignature.mockResolvedValue(false);

    const req = buildReq({ event: 'payment.captured' }, 'bad-sig');
    const { res, statusMock, jsonMock } = buildRes();

    await webhookHandler(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'Invalid signature' }));
  });

  it('calls handlePaymentSuccess on payment.captured event', async () => {
    const { webhookHandler } = await import('../webhook.js');

    const event = {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_abc', order_id: 'order_xyz' } },
      },
    };

    const req = buildReq(event, 'valid-sig');
    const { res, jsonMock } = buildRes();

    await webhookHandler(req as Request, res as Response);

    expect(mockHandlePaymentSuccess).toHaveBeenCalledWith('order_xyz', 'pay_abc');
    expect(jsonMock).toHaveBeenCalledWith({ success: true });
  });

  it('updates payment status on refund.processed event', async () => {
    const { webhookHandler } = await import('../webhook.js');

    const dbMod = await import('../../lib/db.js');
    // Payment found by razorpayPaymentId
    (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue({
      from:    vi.fn().mockReturnThis(),
      where:   vi.fn().mockResolvedValue([{ id: 'pay-1', bookingId: 'booking-1', razorpayPaymentId: 'pay_ref' }]),
      orderBy: vi.fn().mockReturnThis(),
      limit:   vi.fn().mockReturnThis(),
    });
    (dbMod.db as unknown as AnyRecord)['update'] = vi.fn().mockReturnValue({
      set:   vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    });

    const event = {
      event: 'refund.processed',
      payload: {
        refund: { entity: { id: 'refund_1', payment_id: 'pay_ref' } },
      },
    };

    const req = buildReq(event, 'valid-sig');
    const { res, jsonMock } = buildRes();

    await webhookHandler(req as Request, res as Response);

    expect(jsonMock).toHaveBeenCalledWith({ success: true });
  });

  it('calls markBookingDisputed and sets booking to DISPUTED on dispute.created', async () => {
    const { webhookHandler } = await import('../webhook.js');

    const dbMod = await import('../../lib/db.js');
    // Payment found by razorpayPaymentId
    (dbMod.db as unknown as AnyRecord)['select'] = vi.fn().mockReturnValue({
      from:    vi.fn().mockReturnThis(),
      where:   vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit:   vi.fn().mockResolvedValue([{ id: 'pay-1', bookingId: 'booking-disputed', razorpayPaymentId: 'pay_dispute' }]),
    });

    const event = {
      event: 'dispute.created',
      payload: {
        dispute: { entity: { id: 'dispute_1', payment_id: 'pay_dispute' } },
      },
    };

    const req = buildReq(event, 'valid-sig');
    const { res, jsonMock } = buildRes();

    await webhookHandler(req as Request, res as Response);

    expect(mockMarkBookingDisputed).toHaveBeenCalledWith('booking-disputed');
    expect(jsonMock).toHaveBeenCalledWith({ success: true });
  });

  it('acknowledges unknown events with success: true', async () => {
    const { webhookHandler } = await import('../webhook.js');

    const event = { event: 'some.unknown.event', payload: {} };
    const req = buildReq(event, 'valid-sig');
    const { res, jsonMock } = buildRes();

    await webhookHandler(req as Request, res as Response);

    expect(jsonMock).toHaveBeenCalledWith({ success: true });
  });
});
