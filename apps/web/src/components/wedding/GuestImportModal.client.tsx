'use client';

import { useState, useTransition } from 'react';
import { Loader2, Upload, X, Download } from 'lucide-react';
import { importGuestsCsvAction } from '@/app/(app)/weddings/[id]/guests/actions';

const TEMPLATE_HEADER = 'name,phone,email,relationship,side';
const TEMPLATE_SAMPLE = 'Asha Verma,9876543210,asha@example.com,Aunt,BRIDE';

interface GuestImportModalProps {
  weddingId: string;
}

/**
 * "Import Guests" button + modal. Lets the user paste CSV rows (or download a
 * template first), previews the row count, then bulk-imports via the existing
 * CSV import endpoint.
 */
export function GuestImportModal({ weddingId }: GuestImportModalProps) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rowCount = csv
    .trim()
    .split('\n')
    .filter((l, i) => i > 0 && l.trim().length > 0).length;

  function downloadTemplate() {
    const blob = new Blob([`${TEMPLATE_HEADER}\n${TEMPLATE_SAMPLE}\n`], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guest-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function submit() {
    setError(null);
    setResult(null);
    start(async () => {
      const r = await importGuestsCsvAction(weddingId, csv.trim());
      if (r.ok && r.data) {
        const skipped = r.data.invalid.length;
        setResult(
          `${r.data.imported} guest${r.data.imported === 1 ? '' : 's'} imported successfully${
            skipped ? ` · ${skipped} row${skipped === 1 ? '' : 's'} skipped` : ''
          }`,
        );
        setCsv('');
      } else {
        setError(r.error ?? 'Import failed. Check the CSV format.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg border border-gold/40 text-sm font-medium text-primary hover:bg-gold/10 transition-colors"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        Import Guests
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-surface border border-gold/20 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-lg text-primary">Import Guests</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-background transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              Paste CSV rows below. First line must be the header:
              <code className="block mt-1 rounded bg-background px-2 py-1 text-xs">{TEMPLATE_HEADER}</code>
            </p>

            <button
              type="button"
              onClick={downloadTemplate}
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download template CSV
            </button>

            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              placeholder={`${TEMPLATE_HEADER}\n${TEMPLATE_SAMPLE}`}
              className="w-full rounded-lg border border-gold/30 bg-background px-3 py-2 text-sm font-mono outline-none focus:border-teal focus:ring-1 focus:ring-teal"
            />

            {csv.trim() && (
              <p className="mt-1 text-xs text-muted-foreground">{rowCount} row{rowCount === 1 ? '' : 's'} detected</p>
            )}

            {error && (
              <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}
            {result && (
              <div className="mt-3 rounded-lg bg-success/10 border border-success/30 px-4 py-2.5 text-sm text-success">
                {result}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[44px] px-4 rounded-lg border border-gold/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || rowCount === 0}
                className="min-h-[44px] px-5 rounded-lg bg-teal text-white text-sm font-semibold transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Import {rowCount > 0 ? `${rowCount}` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
