'use client';

import { useState, useTransition } from 'react';
import { Loader2, Check } from 'lucide-react';
import type { BudgetCategory } from '@smartshaadi/types';
import { updateBudgetAction } from '@/app/[locale]/(app)/weddings/[id]/actions';

interface BudgetEditorProps {
  weddingId: string;
  total: number;
  currency: string;
  categories: BudgetCategory[];
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;
}

/**
 * Inline-editable budget table. Each row's Allocated and Spent are number
 * inputs; on change the local state updates immediately (live totals) and a
 * "Save changes" bar persists the whole categories array via the budget API.
 */
export function BudgetEditor({ weddingId, total, currency, categories }: BudgetEditorProps) {
  const [rows, setRows] = useState<BudgetCategory[]>(
    categories.length > 0 ? categories : [],
  );
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSaving] = useTransition();

  const totalAllocated = rows.reduce((s, c) => s + (Number(c.allocated) || 0), 0);
  const totalSpent     = rows.reduce((s, c) => s + (Number(c.spent) || 0), 0);
  const remaining      = total - totalSpent;

  function patch(idx: number, field: 'allocated' | 'spent', value: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
    setDirty(true);
    setSaved(false);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const res = await updateBudgetAction(
        weddingId,
        rows.map((r) => ({
          name: r.name,
          allocated: Number(r.allocated) || 0,
          spent: Number(r.spent) || 0,
        })),
      );
      if (res.ok) {
        setDirty(false);
        setSaved(true);
      } else {
        setError(res.error ?? 'Could not save budget.');
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total Budget" value={fmt(total, currency)} color="text-primary" />
        <SummaryCard label="Spent" value={fmt(totalSpent, currency)} color="text-destructive" />
        <SummaryCard label="Remaining" value={fmt(remaining, currency)} color="text-teal" />
      </div>

      {/* Overall progress */}
      <div className="bg-surface border border-gold/20 rounded-2xl shadow-card p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-foreground">Spent vs Budget</span>
          <span className="text-muted-foreground">{pct(totalSpent, total)}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-secondary">
          <div
            className="h-2.5 rounded-full transition-all"
            style={{
              width: `${pct(totalSpent, total)}%`,
              backgroundColor: totalSpent > total ? 'var(--color-destructive)' : 'var(--color-teal)',
            }}
          />
        </div>
      </div>

      {/* Editable category table */}
      {rows.length > 0 ? (
        <div className="bg-surface border border-gold/20 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/10 bg-background">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Allocated</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Spent</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-24">Progress</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cat, i) => {
                const over = cat.spent > cat.allocated;
                const p = pct(cat.spent, cat.allocated);
                return (
                  <tr key={cat.name} className="border-b border-gold/10 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={cat.allocated}
                        onChange={(e) => patch(i, 'allocated', Number(e.target.value))}
                        className="w-28 rounded-lg border border-gold/30 px-2 py-1.5 text-right text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                        aria-label={`${cat.name} allocated`}
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={cat.spent}
                        onChange={(e) => patch(i, 'spent', Number(e.target.value))}
                        className={`w-28 rounded-lg border px-2 py-1.5 text-right text-sm outline-none focus:ring-1 focus:ring-teal ${
                          over ? 'border-destructive/60 text-destructive' : 'border-gold/30 focus:border-teal'
                        }`}
                        aria-label={`${cat.name} spent`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 w-full rounded-full bg-secondary">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${p}%`,
                            backgroundColor: over ? 'var(--color-destructive)' : 'var(--color-gold)',
                          }}
                        />
                      </div>
                      <span className="text-2xs text-muted-foreground">{p}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-background border-t border-gold/20">
                <td className="px-4 py-3 font-semibold text-foreground">Total</td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(totalAllocated, currency)}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(totalSpent, currency)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="bg-surface border border-dashed border-gold/30 rounded-xl p-8 text-center text-muted-foreground text-sm">
          No budget categories yet.
        </div>
      )}

      {/* Save bar */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        {saved && !dirty && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" aria-hidden="true" /> Saved
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="min-h-[44px] px-5 rounded-lg bg-teal text-white text-sm font-semibold transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save changes
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-semibold ${color}`}>{value}</p>
    </div>
  );
}
