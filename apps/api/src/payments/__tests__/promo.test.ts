/**
 * Smart Shaadi — Promo Service Tests.
 * Covers: discount calc, max discount cap, scope mismatch, per-user limit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@smartshaadi/db', () => ({
  promoCodes: {
    id: 'p.id', code: 'p.code', isActive: 'p.isActive', validFrom: 'p.validFrom',
    validUntil: 'p.validUntil', scope: 'p.scope', minOrderAmount: 'p.minOrderAmount',
    usageLimit: 'p.usageLimit', usedCount: 'p.usedCount', perUserLimit: 'p.perUserLimit',
    firstTimeUserOnly: 'p.firstTimeUserOnly', createdAt: 'p.createdAt',
  },
  promoRedemptions: { promoId: 'pr.promoId', userId: 'pr.userId' },
  bookings: { customerId: 'b.customerId', id: 'b.id' },
  user: { id: 'u.id', role: 'u.role' },
  auditEventTypeEnum: { enumValues: [] },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})), and: vi.fn(() => ({})), or: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})), gt: vi.fn(() => ({})), lt: vi.fn(() => ({})),
  desc: vi.fn(() => ({})), sql: vi.fn(() => ({})),
}));

vi.mock('../service.js', () => ({ appendAuditLog: vi.fn().mockResolvedValue(undefined) }));

interface PromoRow {
  id: string; code: string; type: 'PERCENT' | 'FLAT'; value: string;
  scope: string; minOrderAmount: string; maxDiscount: string | null;
  usageLimit: number | null; usedCount: number; perUserLimit: number;
  firstTimeUserOnly: boolean;
}

const state: {
  promo: PromoRow | undefined;
  redemptionsForUser: number;
} = {
  promo: undefined,
  redemptionsForUser: 0,
};

const selectCallCount = { n: 0 };

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn().mockImplementation(() => {
      selectCallCount.n++;
      if (selectCallCount.n === 1) {
        return {
          from:  vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(state.promo ? [state.promo] : []),
        };
      }
      return {
        from:  vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: String(state.redemptionsForUser) }]),
      };
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.redemptionsForUser = 0;
  selectCallCount.n = 0;
});

describe('promo.quotePromo', () => {
  it('throws NOT_FOUND for unknown code', async () => {
    state.promo = undefined;
    const { quotePromo, PromoError } = await import('../promo.js');
    await expect(quotePromo('u-1', { code: 'BOGUS', amount: 1000, scope: 'BOOKING' }))
      .rejects.toThrow(PromoError);
  });

  it('computes 10% discount, caps at maxDiscount', async () => {
    state.promo = {
      id: 'p1', code: 'TEN', type: 'PERCENT', value: '10', scope: 'ALL',
      minOrderAmount: '0', maxDiscount: '50', usageLimit: null, usedCount: 0,
      perUserLimit: 1, firstTimeUserOnly: false,
    };
    const { quotePromo } = await import('../promo.js');
    const r = await quotePromo('u-1', { code: 'TEN', amount: 1000, scope: 'BOOKING' });
    expect(r.discount).toBe(50);
    expect(r.finalAmount).toBe(950);
  });

  it('rejects when below min order', async () => {
    state.promo = {
      id: 'p1', code: 'BIG', type: 'FLAT', value: '100', scope: 'ALL',
      minOrderAmount: '500', maxDiscount: null, usageLimit: null, usedCount: 0,
      perUserLimit: 1, firstTimeUserOnly: false,
    };
    const { quotePromo, PromoError } = await import('../promo.js');
    await expect(quotePromo('u-1', { code: 'BIG', amount: 200, scope: 'BOOKING' }))
      .rejects.toThrow(PromoError);
  });

  it('rejects when scope does not match', async () => {
    state.promo = {
      id: 'p1', code: 'STORE10', type: 'PERCENT', value: '10', scope: 'STORE',
      minOrderAmount: '0', maxDiscount: null, usageLimit: null, usedCount: 0,
      perUserLimit: 1, firstTimeUserOnly: false,
    };
    const { quotePromo, PromoError } = await import('../promo.js');
    await expect(quotePromo('u-1', { code: 'STORE10', amount: 1000, scope: 'BOOKING' }))
      .rejects.toThrow(PromoError);
  });

  it('rejects when per-user limit reached', async () => {
    state.promo = {
      id: 'p1', code: 'ONCE', type: 'FLAT', value: '50', scope: 'ALL',
      minOrderAmount: '0', maxDiscount: null, usageLimit: null, usedCount: 0,
      perUserLimit: 1, firstTimeUserOnly: false,
    };
    state.redemptionsForUser = 1;
    const { quotePromo, PromoError } = await import('../promo.js');
    await expect(quotePromo('u-1', { code: 'ONCE', amount: 500, scope: 'BOOKING' }))
      .rejects.toThrow(PromoError);
  });

  it('flat discount cannot exceed amount', async () => {
    state.promo = {
      id: 'p1', code: 'BIG', type: 'FLAT', value: '5000', scope: 'ALL',
      minOrderAmount: '0', maxDiscount: null, usageLimit: null, usedCount: 0,
      perUserLimit: 1, firstTimeUserOnly: false,
    };
    const { quotePromo } = await import('../promo.js');
    const r = await quotePromo('u-1', { code: 'BIG', amount: 1000, scope: 'BOOKING' });
    expect(r.discount).toBe(1000);
    expect(r.finalAmount).toBe(0);
  });
});
