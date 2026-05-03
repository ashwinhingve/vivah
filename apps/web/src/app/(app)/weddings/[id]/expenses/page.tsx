import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Wallet, AlertTriangle, Receipt, Plus } from 'lucide-react';
import { fetchExpenses, fetchExpenseSummary } from '@/lib/wedding-api';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingSummary } from '@smartshaadi/types';
import { createExpenseAction, deleteExpenseAction, recordPaymentAction } from './actions';

const STATUS_COLORS: Record<string, string> = {
  DRAFT:          'bg-secondary text-foreground',
  DUE:            'bg-amber-100 text-amber-800',
  PARTIALLY_PAID: 'bg-teal/10 text-teal',
  PAID:           'bg-green-100 text-green-800',
  CANCELLED:      'bg-destructive/15 text-destructive',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

interface PageProps { params: Promise<{ id: string }> }

export default async function ExpensesPage({ params }: PageProps) {
  const { id } = await params;
  const [wedding, expensesRes, summary] = await Promise.all([
    fetchAuth<WeddingSummary & { plan?: { budget?: { categories?: Array<{ name: string; allocated: number; spent: number }> } } }>(`/api/v1/weddings/${id}`),
    fetchExpenses(id),
    fetchExpenseSummary(id),
  ]);
  if (!wedding) notFound();

  const expenses = expensesRes?.expenses ?? [];
  const categories = wedding.plan?.budget?.categories?.map(c => c.name) ?? [
    'Venue', 'Catering', 'Decoration', 'Photography', 'Music', 'Mehendi',
    'Makeup', 'Invitation', 'Transport', 'Miscellaneous',
  ];
  const overBudget = summary?.overBudget ?? false;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-4 transition-colors min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back to Wedding
        </Link>

        <h1 className="font-heading text-2xl text-[#7B2D42] mb-6">Expenses</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Budget" value={fmt(summary?.totalBudget ?? 0)} />
          <SummaryCard label="Committed" value={fmt(summary?.totalCommitted ?? 0)} />
          <SummaryCard label="Paid" value={fmt(summary?.totalPaid ?? 0)} success />
          <SummaryCard label="Outstanding" value={fmt(summary?.totalOutstanding ?? 0)} warning={(summary?.totalOutstanding ?? 0) > 0} />
        </div>

        {overBudget && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Over budget</p>
              <p className="text-sm text-destructive">Committed expenses exceed your total wedding budget.</p>
            </div>
          </div>
        )}

        {/* By category */}
        <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-[#0A1F4D] mb-3">By category</h2>
          <div className="space-y-2">
            {(summary?.byCategory ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No expenses yet.</p>
            )}
            {(summary?.byCategory ?? []).map(c => {
              const denom = c.allocated > 0 ? c.allocated : Math.max(c.committed, 1);
              const pct = Math.min(100, Math.round((c.committed / denom) * 100));
              const over = c.allocated > 0 && c.committed > c.allocated;
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-foreground">{c.category}</span>
                    <span className="text-muted-foreground">
                      {fmt(c.committed)}{c.allocated > 0 ? ` / ${fmt(c.allocated)}` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#F5EFE8]">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: over ? '#DC2626' : '#0E7C7B' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming due */}
        {(summary?.upcomingDue ?? []).length > 0 && (
          <div className="bg-surface border border-amber-200 rounded-xl shadow-sm p-5 mb-6">
            <h2 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Upcoming payments
            </h2>
            <ul className="divide-y divide-[#C5A47E]/10">
              {summary!.upcomingDue.map(d => (
                <li key={d.expenseId} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-foreground">{d.label}</p>
                    <p className="text-xs text-muted-foreground">Due {new Date(d.dueDate).toLocaleDateString('en-IN')}</p>
                  </div>
                  <span className="font-semibold text-amber-700">{fmt(d.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Expenses table */}
        <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#C5A47E]/10">
            <h2 className="font-semibold text-[#0A1F4D]">All expenses ({expenses.length})</h2>
          </div>
          {expenses.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt className="h-10 w-10 text-[#C5A47E] mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No expenses yet. Add your first one below.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C5A47E]/10 bg-[#FEFAF6] text-left">
                  <th className="px-4 py-2 font-medium text-muted-foreground">Item</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Due</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground text-right">Amount</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground text-right">Paid</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-b border-[#C5A47E]/10 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {e.label}
                      {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.category}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {e.dueDate ? new Date(e.dueDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(e.amount)}</td>
                    <td className="px-4 py-3 text-right">{fmt(e.paid)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status] ?? ''}`}>
                        {e.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-2 justify-end">
                      {e.status !== 'PAID' && e.status !== 'CANCELLED' && (
                        <details className="relative">
                          <summary className="text-xs font-medium text-[#0E7C7B] hover:underline cursor-pointer list-none">Pay</summary>
                          <form action={recordPaymentAction.bind(null, id, e.id)} className="absolute right-0 mt-1 z-10 w-56 rounded-lg border border-[#C5A47E]/30 bg-surface p-3 space-y-2 shadow-lg">
                            <input name="amount" type="number" min="1" step="1" placeholder={`Up to ${e.amount - e.paid}`} className="w-full rounded border border-[#C5A47E]/30 px-2 py-1 text-xs" required />
                            <button type="submit" className="w-full rounded bg-[#0E7C7B] text-white text-xs py-1.5">Record</button>
                          </form>
                        </details>
                      )}
                      <form action={deleteExpenseAction.bind(null, id, e.id)}>
                        <button type="submit" className="text-xs text-destructive hover:underline" aria-label="Delete expense">×</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add expense */}
        <details className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-5 mb-6">
          <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium text-[#7B2D42] list-none">
            <Plus className="h-4 w-4" /> Add expense
          </summary>
          <form action={createExpenseAction.bind(null, id)} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Item" name="label" required />
            <SelectField label="Category" name="category" options={categories} />
            <Field label="Amount (₹)" name="amount" type="number" min="1" step="1" required />
            <Field label="Already paid (₹)" name="paid" type="number" min="0" step="1" />
            <Field label="Due date" name="dueDate" type="date" />
            <Field label="Notes" name="notes" />
            <button type="submit" className="md:col-span-2 min-h-[44px] rounded-lg bg-[#7B2D42] text-white font-semibold text-sm">Save expense</button>
          </form>
        </details>

        <p className="text-center text-xs text-muted-foreground">
          <Wallet className="h-3 w-3 inline mr-1" />
          {expenses.length} expense{expenses.length === 1 ? '' : 's'} · linked to your wedding plan budget
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, success, warning }: { label: string; value: string; success?: boolean; warning?: boolean }) {
  const color = success ? 'text-[#0E7C7B]' : warning ? 'text-amber-700' : 'text-[#7B2D42]';
  return (
    <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-semibold text-base ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, name, type = 'text', required, min, step }: { label: string; name: string; type?: string; required?: boolean; min?: string; step?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}{required && ' *'}</label>
      <input type={type} name={name} required={required} min={min} step={step}
        className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2D42]/20" />
    </div>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select name={name} className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
