import type { BudgetCategory } from '@smartshaadi/types';

interface BudgetTrackerProps {
  total: number;
  currency: string;
  categories: BudgetCategory[];
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;
}

export function BudgetTracker({ total, currency, categories }: BudgetTrackerProps) {
  const totalAllocated = categories.reduce((s, c) => s + c.allocated, 0);
  const totalSpent     = categories.reduce((s, c) => s + c.spent, 0);
  const remaining      = total - totalSpent;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total Budget"    value={fmt(total, currency)}          color="text-[#7B2D42]" />
        <SummaryCard label="Spent"           value={fmt(totalSpent, currency)}      color="text-red-700" />
        <SummaryCard label="Remaining"       value={fmt(remaining, currency)}       color="text-[#0E7C7B]" />
      </div>

      {/* Overall progress */}
      <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-foreground">Spent vs Budget</span>
          <span className="text-muted-foreground">{pct(totalSpent, total)}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[#F5EFE8]">
          <div
            className="h-2.5 rounded-full transition-all"
            style={{
              width:           `${pct(totalSpent, total)}%`,
              backgroundColor: totalSpent > total ? '#DC2626' : '#0E7C7B',
            }}
          />
        </div>
      </div>

      {/* Category table */}
      {categories.length > 0 ? (
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#C5A47E]/10 bg-[#FEFAF6]">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Allocated</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Spent</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Remaining</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-24">Progress</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, i) => {
                const rem  = cat.allocated - cat.spent;
                const over = cat.spent > cat.allocated;
                const p    = pct(cat.spent, cat.allocated);
                return (
                  <tr
                    key={cat.name}
                    className={`border-b border-[#C5A47E]/10 last:border-0 ${
                      i % 2 === 0 ? 'bg-white' : 'bg-[#FEFAF6]/50'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                      {fmt(cat.allocated, currency)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${over ? 'text-red-600' : 'text-foreground'}`}>
                      {fmt(cat.spent, currency)}
                    </td>
                    <td className={`px-4 py-3 text-right hidden sm:table-cell ${over ? 'text-red-600' : 'text-[#0E7C7B]'}`}>
                      {over ? `−${fmt(Math.abs(rem), currency)}` : fmt(rem, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 w-full rounded-full bg-[#F5EFE8]">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width:           `${p}%`,
                            backgroundColor: over ? '#DC2626' : '#C5A47E',
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{p}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#FEFAF6] border-t border-[#C5A47E]/20">
                <td className="px-4 py-3 font-semibold text-foreground">Total</td>
                <td className="px-4 py-3 text-right font-semibold hidden sm:table-cell">
                  {fmt(totalAllocated, currency)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {fmt(totalSpent, currency)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-[#0E7C7B] hidden sm:table-cell">
                  {fmt(total - totalSpent, currency)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-dashed border-[#C5A47E]/30 rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">No budget categories set up yet.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Add categories in your wedding plan to track spending.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-semibold text-base leading-snug ${color}`}>{value}</p>
    </div>
  );
}
