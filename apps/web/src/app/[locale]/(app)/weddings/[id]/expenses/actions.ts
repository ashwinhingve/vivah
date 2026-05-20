'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

function trim(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

function num(v: FormDataEntryValue | null): number | undefined {
  const s = trim(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export async function createExpenseAction(weddingId: string, formData: FormData): Promise<void> {
  const body = {
    category: trim(formData.get('category')) ?? 'Miscellaneous',
    label:    trim(formData.get('label')) ?? 'Expense',
    amount:   num(formData.get('amount')) ?? 0,
    paid:     num(formData.get('paid')) ?? 0,
    vendorId: trim(formData.get('vendorId')),
    dueDate:  trim(formData.get('dueDate')),
    notes:    trim(formData.get('notes')),
  };
  if (body.amount <= 0) return;
  await mutateApi(`/api/v1/weddings/${weddingId}/expenses`, { method: 'POST', body });
  revalidatePath(`/weddings/${weddingId}/expenses`);
  revalidatePath(`/weddings/${weddingId}`);
}

export async function deleteExpenseAction(weddingId: string, expenseId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/expenses/${expenseId}`, { method: 'DELETE' });
  revalidatePath(`/weddings/${weddingId}/expenses`);
}

export async function recordPaymentAction(weddingId: string, expenseId: string, formData: FormData): Promise<void> {
  const amount = num(formData.get('amount'));
  if (!amount || amount <= 0) return;
  await mutateApi(`/api/v1/weddings/${weddingId}/expenses/${expenseId}/payments`, {
    method: 'POST',
    body: { amount, notes: trim(formData.get('notes')) },
  });
  revalidatePath(`/weddings/${weddingId}/expenses`);
}
