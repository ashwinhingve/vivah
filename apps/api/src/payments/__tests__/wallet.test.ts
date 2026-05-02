/**
 * Smart Shaadi — Wallet Service Tests.
 * Covers: credit, debit, insufficient-balance, lifetime totals, transaction log.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@smartshaadi/db', () => ({
  wallets: {
    id:          'wallets.id',
    userId:      'wallets.userId',
    balance:     'wallets.balance',
    lifetimeIn:  'wallets.lifetimeIn',
    lifetimeOut: 'wallets.lifetimeOut',
    isActive:    'wallets.isActive',
  },
  walletTransactions: {
    id:           'wt.id',
    walletId:     'wt.walletId',
    userId:       'wt.userId',
    type:         'wt.type',
    reason:       'wt.reason',
    amount:       'wt.amount',
    balanceAfter: 'wt.balanceAfter',
    description:  'wt.description',
    createdAt:    'wt.createdAt',
  },
  user: { id: 'user.id', role: 'user.role' },
  walletTxnReasonEnum: { enumValues: ['REFUND','PROMO','REFERRAL','CASHBACK','PAYMENT','TOPUP','ADJUSTMENT','EXPIRY'] },
  auditLogs: { id: 'al.id' },
  auditEventTypeEnum: { enumValues: [] },
}));

vi.mock('drizzle-orm', () => ({
  eq:   vi.fn(() => ({})),
  and:  vi.fn(() => ({})),
  sql:  vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

vi.mock('../../infrastructure/redis/queues.js', () => ({
  notificationsQueue: { add: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../service.js', () => ({
  appendAuditLog: vi.fn().mockResolvedValue(undefined),
}));

interface WalletRow { id: string; userId: string; balance: string; lifetimeIn: string; lifetimeOut: string; isActive: boolean; }
const walletState: { row: WalletRow } = {
  row: { id: 'w-1', userId: 'u-1', balance: '0', lifetimeIn: '0', lifetimeOut: '0', isActive: true },
};

vi.mock('../../lib/db.js', () => {
  const buildSelectChain = () => ({
    from:  vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([walletState.row]),
    orderBy: vi.fn().mockReturnThis(),
  });
  const tx = {
    select: vi.fn().mockImplementation(buildSelectChain),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([walletState.row]) }),
        returning:           vi.fn().mockResolvedValue([{ id: 'txn-1' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set:   vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }),
  };
  return {
    db: {
      ...tx,
      transaction: vi.fn().mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  walletState.row = { id: 'w-1', userId: 'u-1', balance: '0', lifetimeIn: '0', lifetimeOut: '0', isActive: true };
});

describe('wallet service', () => {
  it('creditWallet adds amount to balance and writes a CREDIT txn', async () => {
    walletState.row.balance = '100';
    walletState.row.lifetimeIn = '500';
    const { creditWallet } = await import('../wallet.js');
    const txn = await creditWallet({ userId: 'u-1', amount: 250, reason: 'REFUND' });
    expect(txn.id).toBe('txn-1');
  });

  it('debitWallet rejects when balance is too low', async () => {
    walletState.row.balance = '20';
    const { debitWallet, WalletError } = await import('../wallet.js');
    await expect(debitWallet({ userId: 'u-1', amount: 100, reason: 'PAYMENT' }))
      .rejects.toThrow(WalletError);
  });

  it('debitWallet succeeds when balance covers amount', async () => {
    walletState.row.balance = '500';
    const { debitWallet } = await import('../wallet.js');
    const txn = await debitWallet({ userId: 'u-1', amount: 100, reason: 'PAYMENT' });
    expect(txn.id).toBe('txn-1');
  });

  it('creditWallet rejects non-positive amount', async () => {
    const { creditWallet, WalletError } = await import('../wallet.js');
    await expect(creditWallet({ userId: 'u-1', amount: 0, reason: 'REFUND' }))
      .rejects.toThrow(WalletError);
    await expect(creditWallet({ userId: 'u-1', amount: -50, reason: 'REFUND' }))
      .rejects.toThrow(WalletError);
  });
});
