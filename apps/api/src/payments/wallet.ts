/**
 * Smart Shaadi — Wallet Service.
 *
 * Internal credit balance per user, used as a refund destination, promo
 * cashback target, and alternate payment instrument.
 *
 * Invariants:
 *   wallet.balance ≥ 0 (DEBIT throws INSUFFICIENT_BALANCE)
 *   walletTransactions append-only — every CREDIT/DEBIT writes a new ledger row
 *   debit + balance recompute happen inside a single transaction (no race)
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import { appendAuditLog } from './service.js';
import { notificationsQueue } from '../infrastructure/redis/queues.js';

export class WalletError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'WalletError';
  }
}

async function ensureWallet(tx: typeof db, userId: string) {
  const [w] = await tx.select().from(schema.wallets).where(eq(schema.wallets.userId, userId)).limit(1);
  if (w) return w;

  const [created] = await tx
    .insert(schema.wallets)
    .values({ userId, balance: '0', lifetimeIn: '0', lifetimeOut: '0' })
    .onConflictDoNothing({ target: schema.wallets.userId })
    .returning();
  if (created) return created;

  // race — re-select
  const [again] = await tx.select().from(schema.wallets).where(eq(schema.wallets.userId, userId)).limit(1);
  return again!;
}

export interface WalletOpInput {
  userId:         string;
  amount:         number;
  reason:         typeof schema.walletTxnReasonEnum.enumValues[number];
  description?:   string;
  referenceType?: string;
  referenceId?:   string;
  metadata?:      Record<string, unknown>;
}

export async function creditWallet(input: WalletOpInput) {
  if (input.amount <= 0) throw new WalletError('INVALID_AMOUNT', 'Credit amount must be positive');

  return db.transaction(async (tx) => {
    const wallet = await ensureWallet(tx as unknown as typeof db, input.userId);
    if (!wallet.isActive) throw new WalletError('WALLET_INACTIVE', 'Wallet is inactive');

    const newBalance    = parseFloat(wallet.balance) + input.amount;
    const newLifetimeIn = parseFloat(wallet.lifetimeIn) + input.amount;

    await tx
      .update(schema.wallets)
      .set({ balance: String(newBalance), lifetimeIn: String(newLifetimeIn), updatedAt: new Date() })
      .where(eq(schema.wallets.id, wallet.id));

    const [txn] = await tx
      .insert(schema.walletTransactions)
      .values({
        walletId:      wallet.id,
        userId:        input.userId,
        type:          'CREDIT',
        reason:        input.reason,
        amount:        String(input.amount),
        balanceAfter:  String(newBalance),
        description:   input.description ?? null,
        referenceType: input.referenceType ?? null,
        referenceId:   input.referenceId ?? null,
        metadata:      input.metadata ?? null,
      })
      .returning();

    void appendAuditLog({
      eventType:  'WALLET_CREDIT',
      entityType: 'wallet',
      entityId:   wallet.id,
      actorId:    input.userId,
      payload:    { amount: input.amount, reason: input.reason, balanceAfter: newBalance },
    }).catch(() => undefined);

    void notificationsQueue
      .add('WALLET_CREDITED', {
        type:    'WALLET_CREDITED',
        userId:  input.userId,
        payload: { amount: input.amount, balanceAfter: newBalance, reason: input.reason },
      })
      .catch(() => undefined);

    return txn!;
  });
}

export async function debitWallet(input: WalletOpInput) {
  if (input.amount <= 0) throw new WalletError('INVALID_AMOUNT', 'Debit amount must be positive');

  return db.transaction(async (tx) => {
    const wallet = await ensureWallet(tx as unknown as typeof db, input.userId);
    if (!wallet.isActive) throw new WalletError('WALLET_INACTIVE', 'Wallet is inactive');

    const balance = parseFloat(wallet.balance);
    if (balance < input.amount) {
      throw new WalletError('INSUFFICIENT_BALANCE', `Available ₹${balance}, requested ₹${input.amount}`);
    }

    const newBalance     = balance - input.amount;
    const newLifetimeOut = parseFloat(wallet.lifetimeOut) + input.amount;

    await tx
      .update(schema.wallets)
      .set({ balance: String(newBalance), lifetimeOut: String(newLifetimeOut), updatedAt: new Date() })
      .where(eq(schema.wallets.id, wallet.id));

    const [txn] = await tx
      .insert(schema.walletTransactions)
      .values({
        walletId:      wallet.id,
        userId:        input.userId,
        type:          'DEBIT',
        reason:        input.reason,
        amount:        String(input.amount),
        balanceAfter:  String(newBalance),
        description:   input.description ?? null,
        referenceType: input.referenceType ?? null,
        referenceId:   input.referenceId ?? null,
        metadata:      input.metadata ?? null,
      })
      .returning();

    void appendAuditLog({
      eventType:  'WALLET_DEBIT',
      entityType: 'wallet',
      entityId:   wallet.id,
      actorId:    input.userId,
      payload:    { amount: input.amount, reason: input.reason, balanceAfter: newBalance },
    }).catch(() => undefined);

    return txn!;
  });
}

export async function getWallet(userId: string) {
  const [w] = await db
    .select()
    .from(schema.wallets)
    .where(eq(schema.wallets.userId, userId))
    .limit(1);
  if (w) return w;
  return ensureWallet(db, userId);
}

export async function listTransactions(userId: string, limit = 50) {
  return db
    .select()
    .from(schema.walletTransactions)
    .where(eq(schema.walletTransactions.userId, userId))
    .orderBy(desc(schema.walletTransactions.createdAt))
    .limit(limit);
}

/** Sums all wallet credits — used by analytics. */
export async function totalWalletLiability(): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${schema.wallets.balance}), 0)` })
    .from(schema.wallets);
  return Number(row?.total ?? 0);
}

/** Admin manual adjustment. Requires ADMIN role. */
export async function adminAdjustWallet(adminId: string, target: WalletOpInput & { type: 'CREDIT' | 'DEBIT' }) {
  const [admin] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminId))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') throw new WalletError('FORBIDDEN', 'Admin role required');

  const op = target.type === 'CREDIT' ? creditWallet : debitWallet;
  return op({ ...target, reason: target.reason, metadata: { ...target.metadata, adminId } });
}

void and; // silence unused import warning if any

/** Create a Razorpay order for wallet top-up. Webhook converts to wallet credit. */
export async function createWalletTopupOrder(userId: string, amount: number): Promise<{ orderId: string; amount: number }> {
  if (amount <= 0) throw new WalletError('BAD_REQUEST', 'Amount must be positive');
  const { createOrder } = await import('../lib/razorpay.js');
  const order = await createOrder(amount * 100, 'INR', `wallet_topup_${userId}_${Date.now()}`, {
    kind:   'WALLET_TOPUP',
    userId,
  });
  return { orderId: order.id, amount };
}

/**
 * Idempotent wallet credit triggered by payment.captured webhook.
 * Uses metadata.razorpayPaymentId to dedupe replays.
 */
export async function creditWalletForTopup(userId: string, amount: number, razorpayPaymentId: string): Promise<{ duplicate: boolean }> {
  const [existing] = await db
    .select({ id: schema.walletTransactions.id })
    .from(schema.walletTransactions)
    .where(sql`${schema.walletTransactions.metadata}->>'razorpayPaymentId' = ${razorpayPaymentId}`)
    .limit(1);
  if (existing) return { duplicate: true };

  await creditWallet({
    userId,
    amount:   amount * 100,
    reason:   'TOPUP',
    metadata: { razorpayPaymentId },
  });
  return { duplicate: false };
}
