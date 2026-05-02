'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { RevenueSummary, RevenueByCategory, DailyRevenuePoint } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface Liability  { label: string; amount: number; }
interface TopVendor  { vendorId: string; vendorName: string; revenue: number; payouts: number; count: number; }

interface Props {
  summary:     RevenueSummary | null;
  daily:       DailyRevenuePoint[];
  categories:  RevenueByCategory[];
  topVendors:  TopVendor[];
  liabilities: Liability[];
  fromDate:    string;
  toDate:      string;
}

const KPI_CONFIG = (s: RevenueSummary) => [
  { label: 'Gross Revenue',       value: formatINR(s.grossRevenue),                    color: '#7B2D42' },
  { label: 'Net Revenue',         value: formatINR(s.netRevenue),                      color: '#0E7C7B' },
  { label: 'Refunded',            value: formatINR(s.refunded),                        color: '#D97706' },
  { label: 'Pending Payouts',     value: formatINR(s.pendingPayouts),                  color: '#7C3AED' },
  { label: 'Platform Fees',       value: formatINR(s.platformFees),                    color: '#0F172A' },
  { label: 'Tax Collected',       value: formatINR(s.taxCollected),                    color: '#059669' },
  { label: 'Avg Booking Value',   value: formatINR(s.avgBookingValue),                 color: '#0F172A' },
  { label: 'Payment Success Rate',value: `${s.paymentSuccessRate.toFixed(1)}%`,        color: '#059669' },
];

export function AdminRevenueClient({ summary, daily, categories, topVendors, liabilities, fromDate, toDate }: Props) {
  const router = useRouter();
  const [from, setFrom] = useState(fromDate);
  const [to,   setTo]   = useState(toDate);
  const [, startTransition] = useTransition();

  function applyFilter() {
    startTransition(() => {
      router.push(`/admin/revenue?from=${from}&to=${to}`);
    });
  }

  const maxGross = daily.length > 0 ? Math.max(...daily.map(d => d.gross)) : 1;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: '#FEFAF6' }}>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#7B2D42' }}>Revenue Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Financial overview across all transactions</p>
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={from}
              max={to}
              onChange={e => setFrom(e.target.value)}
              className="h-9 rounded-lg border border-input bg-surface px-3 text-sm focus:outline-none focus:border-teal"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={e => setTo(e.target.value)}
              className="h-9 rounded-lg border border-input bg-surface px-3 text-sm focus:outline-none focus:border-teal"
            />
            <Button size="sm" onClick={applyFilter}>Apply</Button>
          </div>
        </div>

        {/* KPI grid */}
        {summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {KPI_CONFIG(summary).map(kpi => (
              <div
                key={kpi.label}
                className="rounded-xl bg-surface border shadow-sm px-4 py-4"
                style={{ borderColor: '#C5A47E' }}
              >
                <p className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-tight">{kpi.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-dashed py-10 text-center" style={{ borderColor: '#C5A47E' }}>
            <p className="text-sm text-muted-foreground">Revenue summary unavailable for this period.</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Daily revenue chart */}
          <div className="lg:col-span-2 rounded-xl border bg-surface shadow-sm p-5" style={{ borderColor: '#C5A47E' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#7B2D42' }}>Daily Gross Revenue</h2>
            {daily.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 h-32 min-w-[320px]">
                  {daily.map(pt => {
                    const height = maxGross > 0 ? Math.max(2, Math.round((pt.gross / maxGross) * 100)) : 2;
                    return (
                      <div
                        key={pt.date}
                        className="flex-1 flex flex-col items-center gap-1 group"
                        title={`${formatDate(pt.date)}: ${formatINR(pt.gross)}`}
                      >
                        <div
                          className="w-full rounded-t-sm transition-all"
                          style={{ height: `${height}%`, background: '#0E7C7B', minHeight: 2 }}
                        />
                        {daily.length <= 14 && (
                          <span className="text-[9px] text-muted-foreground rotate-0 whitespace-nowrap">
                            {formatDate(pt.date)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {daily.length > 14 && (
                  <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                    <span>{formatDate(daily[0]!.date)}</span>
                    <span>{formatDate(daily[daily.length - 1]!.date)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Liabilities */}
          <div className="rounded-xl border bg-surface shadow-sm p-5" style={{ borderColor: '#C5A47E' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#7B2D42' }}>Liabilities</h2>
            {liabilities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No liabilities data.</p>
            ) : (
              <div className="space-y-3">
                {liabilities.map(l => (
                  <div key={l.label} className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{l.label}</span>
                    <span className="text-sm font-semibold text-foreground">{formatINR(l.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          {/* Category breakdown */}
          <div className="rounded-xl border bg-surface shadow-sm p-5" style={{ borderColor: '#C5A47E' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#7B2D42' }}>Revenue by Category</h2>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No category data.</p>
            ) : (
              <div className="space-y-3">
                {categories.map(cat => (
                  <div key={cat.category}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-foreground">{cat.category}</span>
                      <span className="text-xs text-muted-foreground">{formatINR(cat.revenue)} · {cat.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(cat.pct, 100)}%`, background: '#0E7C7B' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top vendors */}
          <div className="rounded-xl border bg-surface shadow-sm p-5" style={{ borderColor: '#C5A47E' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#7B2D42' }}>Top Vendors</h2>
            {topVendors.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No vendor data.</p>
            ) : (
              <div className="space-y-3">
                {topVendors.slice(0, 8).map((v, i) => (
                  <div key={v.vendorId} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{v.vendorName}</p>
                      <p className="text-[10px] text-muted-foreground">{v.count} bookings</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-foreground">{formatINR(v.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground">paid out {formatINR(v.payouts)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
