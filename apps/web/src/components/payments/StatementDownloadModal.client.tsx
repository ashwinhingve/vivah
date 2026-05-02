'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

interface Props {
  onClose: () => void;
}

export function StatementDownloadModal({ onClose }: Props) {
  const [fromDate,    setFromDate]    = useState(thirtyDaysAgoISO());
  const [toDate,      setToDate]      = useState(todayISO());
  const [downloading, setDownloading] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    if (!fromDate || !toDate) {
      setError('Please select both a start and end date.');
      return;
    }
    if (fromDate > toDate) {
      setError('Start date cannot be after end date.');
      return;
    }

    setDownloading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/payments/statement?fromDate=${fromDate}&toDate=${toDate}&format=csv`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? 'Failed to generate statement. Please try again.');
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `smart-shaadi-statement-${fromDate}-to-${toDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-modal-title"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface border shadow-xl"
        style={{ borderColor: '#C5A47E' }}
      >
        <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#C5A47E' }}>
          <h2 id="statement-modal-title" className="font-heading text-lg font-semibold" style={{ color: '#7B2D42' }}>
            Download Statement
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a date range to export your payment history as a CSV file.
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1" htmlFor="stmt-from">
              From date
            </label>
            <input
              id="stmt-from"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full h-11 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1" htmlFor="stmt-to">
              To date
            </label>
            <input
              id="stmt-to"
              type="date"
              value={toDate}
              min={fromDate}
              max={todayISO()}
              onChange={e => setToDate(e.target.value)}
              className="w-full h-11 rounded-lg border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={downloading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Generating…' : 'Download CSV'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
