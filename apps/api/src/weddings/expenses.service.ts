/**
 * Smart Shaadi — Wedding Expenses
 *
 * Detailed line-item expense tracking on top of the high-level budget
 * categories already stored in MongoDB WeddingPlan.budget.
 *
 * Supports vendor/booking linkage, partial payments, due dates, and a
 * derived summary that blends category allocations with committed/paid.
 */

import { eq, and, desc, asc, sql, gt } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import {
  weddingExpenses,
  weddings,
  ceremonies,
} from '@smartshaadi/db';
import type {
  WeddingExpense,
  ExpenseSummary,
  BudgetCategory,
  CeremonyBudgetRollup,
  CeremonyBudgetRow,
  CeremonyType,
} from '@smartshaadi/types';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  RecordPaymentInput,
} from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';
import { mockGet } from '../lib/mockStore.js';
import { WeddingPlan } from '../infrastructure/mongo/models/WeddingPlan.js';

type Row = typeof weddingExpenses.$inferSelect;

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

function toDto(r: Row): WeddingExpense {
  return {
    id:           r.id,
    weddingId:    r.weddingId,
    category:     r.category,
    label:        r.label,
    vendorId:     r.vendorId,
    bookingId:    r.bookingId,
    amount:       Number(r.amount),
    paid:         Number(r.paid),
    currency:     r.currency,
    dueDate:      r.dueDate ?? null,
    paidAt:       r.paidAt ? r.paidAt.toISOString() : null,
    status:       r.status,
    receiptR2Key: r.receiptR2Key ?? null,
    notes:        r.notes ?? null,
    createdAt:    r.createdAt.toISOString(),
  };
}

function deriveStatus(amount: number, paid: number, current?: Row['status']): Row['status'] {
  if (current === 'CANCELLED') return 'CANCELLED';
  if (paid <= 0) return current === 'DUE' ? 'DUE' : 'DRAFT';
  if (paid >= amount) return 'PAID';
  return 'PARTIALLY_PAID';
}

export async function listExpenses(weddingId: string, userId: string): Promise<WeddingExpense[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  const rows = await db
    .select()
    .from(weddingExpenses)
    .where(eq(weddingExpenses.weddingId, weddingId))
    .orderBy(asc(weddingExpenses.dueDate), desc(weddingExpenses.createdAt));
  return rows.map(toDto);
}

export async function createExpense(
  weddingId: string,
  userId: string,
  input: CreateExpenseInput,
): Promise<WeddingExpense> {
  await requireRole(weddingId, userId, 'EDITOR');

  const amount = input.amount;
  const paid   = input.paid ?? 0;
  if (paid > amount) throw appErr('paid cannot exceed amount', 'VALIDATION_ERROR', 400);

  const [row] = await db
    .insert(weddingExpenses)
    .values({
      weddingId,
      category:     input.category,
      label:        input.label,
      amount:       String(amount),
      paid:         String(paid),
      vendorId:     input.vendorId ?? null,
      bookingId:    input.bookingId ?? null,
      dueDate:      input.dueDate ?? null,
      status:       deriveStatus(amount, paid, input.status),
      receiptR2Key: input.receiptR2Key ?? null,
      notes:        input.notes ?? null,
      createdBy:    userId,
      paidAt:       paid >= amount ? new Date() : null,
    })
    .returning();

  if (!row) throw appErr('Failed to create expense', 'EXPENSE_CREATE_FAILED', 500);

  await logActivity(weddingId, userId, 'expense.create', 'expense', row.id, {
    label: input.label, amount,
  });

  return toDto(row);
}

export async function updateExpense(
  weddingId: string,
  userId: string,
  expenseId: string,
  input: UpdateExpenseInput,
): Promise<WeddingExpense> {
  await requireRole(weddingId, userId, 'EDITOR');

  const [existing] = await db
    .select()
    .from(weddingExpenses)
    .where(and(eq(weddingExpenses.id, expenseId), eq(weddingExpenses.weddingId, weddingId)))
    .limit(1);
  if (!existing) throw appErr('Expense not found', 'NOT_FOUND', 404);

  const newAmount = input.amount ?? Number(existing.amount);
  const newPaid   = input.paid   ?? Number(existing.paid);
  if (newPaid > newAmount) throw appErr('paid cannot exceed amount', 'VALIDATION_ERROR', 400);

  const updates: Partial<typeof weddingExpenses.$inferInsert> = { updatedAt: new Date() };
  if (input.category   !== undefined) updates.category   = input.category;
  if (input.label      !== undefined) updates.label      = input.label;
  if (input.vendorId   !== undefined) updates.vendorId   = input.vendorId ?? null;
  if (input.bookingId  !== undefined) updates.bookingId  = input.bookingId ?? null;
  if (input.amount     !== undefined) updates.amount     = String(input.amount);
  if (input.paid       !== undefined) updates.paid       = String(input.paid);
  if (input.dueDate    !== undefined) updates.dueDate    = input.dueDate ?? null;
  if (input.receiptR2Key !== undefined) updates.receiptR2Key = input.receiptR2Key ?? null;
  if (input.notes      !== undefined) updates.notes      = input.notes ?? null;
  updates.status = deriveStatus(newAmount, newPaid, input.status ?? existing.status);
  updates.paidAt = newPaid >= newAmount ? (existing.paidAt ?? new Date()) : null;

  const [row] = await db
    .update(weddingExpenses)
    .set(updates)
    .where(and(eq(weddingExpenses.id, expenseId), eq(weddingExpenses.weddingId, weddingId)))
    .returning();

  if (!row) throw appErr('Expense update failed', 'EXPENSE_UPDATE_FAILED', 500);

  await logActivity(weddingId, userId, 'expense.update', 'expense', expenseId, { label: row.label });
  return toDto(row);
}

export async function deleteExpense(
  weddingId: string,
  userId: string,
  expenseId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  const deleted = await db
    .delete(weddingExpenses)
    .where(and(eq(weddingExpenses.id, expenseId), eq(weddingExpenses.weddingId, weddingId)))
    .returning({ id: weddingExpenses.id });

  if (deleted.length === 0) throw appErr('Expense not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'expense.delete', 'expense', expenseId);
}

export async function recordPayment(
  weddingId: string,
  userId: string,
  expenseId: string,
  input: RecordPaymentInput,
): Promise<WeddingExpense> {
  await requireRole(weddingId, userId, 'EDITOR');

  const [existing] = await db
    .select()
    .from(weddingExpenses)
    .where(and(eq(weddingExpenses.id, expenseId), eq(weddingExpenses.weddingId, weddingId)))
    .limit(1);
  if (!existing) throw appErr('Expense not found', 'NOT_FOUND', 404);

  const amount = Number(existing.amount);
  const newPaid = Math.min(Number(existing.paid) + input.amount, amount);
  const status  = deriveStatus(amount, newPaid, existing.status);

  const [row] = await db
    .update(weddingExpenses)
    .set({
      paid:         String(newPaid),
      status,
      paidAt:       status === 'PAID' ? new Date() : existing.paidAt,
      receiptR2Key: input.receiptR2Key ?? existing.receiptR2Key,
      updatedAt:    new Date(),
    })
    .where(eq(weddingExpenses.id, expenseId))
    .returning();

  if (!row) throw appErr('Payment record failed', 'PAYMENT_RECORD_FAILED', 500);

  await logActivity(weddingId, userId, 'expense.payment', 'expense', expenseId, {
    amount: input.amount, totalPaid: newPaid,
  });

  return toDto(row);
}

async function getBudgetTotals(weddingId: string): Promise<{ total: number; categories: BudgetCategory[] }> {
  if (env.USE_MOCK_SERVICES) {
    const raw = mockGet(`wedding_plan:${weddingId}`);
    const plan = (raw?.['plan'] as { budget?: { total?: number; categories?: BudgetCategory[] } } | undefined);
    return {
      total:      plan?.budget?.total ?? 0,
      categories: plan?.budget?.categories ?? [],
    };
  }
  const doc = await WeddingPlan.findOne({ weddingId }).lean();
  return {
    total:      (doc?.budget?.total as number | undefined) ?? 0,
    categories: ((doc?.budget?.categories ?? []) as BudgetCategory[]),
  };
}

export async function getExpenseSummary(
  weddingId: string,
  userId: string,
): Promise<ExpenseSummary> {
  await requireRole(weddingId, userId, 'VIEWER');

  const [weddingRow] = await db
    .select({ budgetTotal: weddings.budgetTotal })
    .from(weddings)
    .where(eq(weddings.id, weddingId))
    .limit(1);

  const totalBudget = weddingRow?.budgetTotal ? Number(weddingRow.budgetTotal) : 0;
  const { categories } = await getBudgetTotals(weddingId);
  const allocatedByCat = new Map(categories.map(c => [c.name, c.allocated]));

  const rows = await db
    .select()
    .from(weddingExpenses)
    .where(eq(weddingExpenses.weddingId, weddingId));

  const aggByCat = new Map<string, { committed: number; paid: number }>();
  let totalCommitted = 0;
  let totalPaid      = 0;

  for (const r of rows) {
    if (r.status === 'CANCELLED') continue;
    const amount = Number(r.amount);
    const paid   = Number(r.paid);
    totalCommitted += amount;
    totalPaid      += paid;

    const agg = aggByCat.get(r.category) ?? { committed: 0, paid: 0 };
    agg.committed += amount;
    agg.paid      += paid;
    aggByCat.set(r.category, agg);
  }

  const allCategories = new Set<string>([...allocatedByCat.keys(), ...aggByCat.keys()]);
  const byCategory = [...allCategories].map((name) => {
    const allocated   = allocatedByCat.get(name) ?? 0;
    const agg         = aggByCat.get(name) ?? { committed: 0, paid: 0 };
    return {
      category:    name,
      allocated,
      committed:   agg.committed,
      paid:        agg.paid,
      outstanding: agg.committed - agg.paid,
    };
  }).sort((a, b) => b.committed - a.committed);

  const totalAllocated = byCategory.reduce((s, c) => s + c.allocated, 0);

  // Upcoming due — within 30 days, unpaid or partial
  const upcoming = await db
    .select({
      id: weddingExpenses.id,
      label: weddingExpenses.label,
      amount: weddingExpenses.amount,
      paid:   weddingExpenses.paid,
      dueDate: weddingExpenses.dueDate,
    })
    .from(weddingExpenses)
    .where(and(
      eq(weddingExpenses.weddingId, weddingId),
      gt(weddingExpenses.dueDate, sql`CURRENT_DATE - INTERVAL '1 day'`),
    ))
    .orderBy(asc(weddingExpenses.dueDate))
    .limit(20);

  const upcomingDue = upcoming
    .filter(u => u.dueDate && Number(u.paid) < Number(u.amount))
    .slice(0, 8)
    .map(u => ({
      expenseId: u.id,
      label:     u.label,
      amount:    Number(u.amount) - Number(u.paid),
      dueDate:   u.dueDate as string,
    }));

  return {
    totalBudget,
    totalAllocated,
    totalCommitted,
    totalPaid,
    totalOutstanding: totalCommitted - totalPaid,
    overBudget:       totalBudget > 0 && totalCommitted > totalBudget,
    byCategory,
    upcomingDue,
  };
}

// ── Per-ceremony Budget Rollup ───────────────────────────────────────────────

export async function getCeremonyBudgetRollup(
  weddingId: string,
  userId: string,
): Promise<CeremonyBudgetRollup> {
  await requireRole(weddingId, userId, 'VIEWER');

  const [weddingRow] = await db
    .select({ budgetTotal: weddings.budgetTotal })
    .from(weddings)
    .where(eq(weddings.id, weddingId))
    .limit(1);
  const totalBudget = weddingRow?.budgetTotal ? Number(weddingRow.budgetTotal) : 0;

  const ceremonyRows = await db
    .select({ id: ceremonies.id, type: ceremonies.type, date: ceremonies.date })
    .from(ceremonies)
    .where(eq(ceremonies.weddingId, weddingId));

  const expenseRows = await db
    .select()
    .from(weddingExpenses)
    .where(eq(weddingExpenses.weddingId, weddingId));

  const map = new Map<string | null, { committed: number; paid: number; count: number }>();
  for (const r of expenseRows) {
    if (r.status === 'CANCELLED') continue;
    const key = r.ceremonyId ?? null;
    const agg = map.get(key) ?? { committed: 0, paid: 0, count: 0 };
    agg.committed += Number(r.amount);
    agg.paid      += Number(r.paid);
    agg.count     += 1;
    map.set(key, agg);
  }

  const rows: CeremonyBudgetRow[] = [];

  for (const c of ceremonyRows) {
    const agg = map.get(c.id) ?? { committed: 0, paid: 0, count: 0 };
    rows.push({
      ceremonyId:    c.id,
      ceremonyType:  c.type as CeremonyType,
      ceremonyDate:  (c.date as unknown as string | null) ?? null,
      allocated:     0,  // future: per-ceremony allocations table
      spent:         agg.paid,
      committed:     agg.committed - agg.paid,
      remaining:     0,
      overBudget:    false,
      expensesCount: agg.count,
    });
  }

  const unallocated = map.get(null) ?? { committed: 0, paid: 0, count: 0 };
  if (unallocated.count > 0) {
    rows.push({
      ceremonyId:    null,
      ceremonyType:  null,
      ceremonyDate:  null,
      allocated:     0,
      spent:         unallocated.paid,
      committed:     unallocated.committed - unallocated.paid,
      remaining:     0,
      overBudget:    false,
      expensesCount: unallocated.count,
    });
  }

  const totalSpent     = rows.reduce((s, r) => s + r.spent, 0);
  const totalCommitted = rows.reduce((s, r) => s + r.committed, 0);
  const totalRemaining = Math.max(0, totalBudget - totalSpent - totalCommitted);

  return {
    weddingId,
    totalBudget,
    totalSpent,
    totalCommitted,
    totalRemaining,
    rows: rows.sort((a, b) => (a.ceremonyDate ?? '~').localeCompare(b.ceremonyDate ?? '~')),
  };
}
