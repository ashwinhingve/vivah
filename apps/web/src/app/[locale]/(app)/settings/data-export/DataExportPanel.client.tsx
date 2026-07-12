'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, RefreshCw, FileArchive, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  requestExportAction,
  getDownloadUrlAction,
  type ExportRequest,
  type ExportStatus,
} from './actions';

function StatusBadge({ status }: { status: ExportStatus }) {
  const map: Record<ExportStatus, { label: string; cls: string }> = {
    PENDING:    { label: 'Queued',     cls: 'bg-warning/10 text-warning' },
    PROCESSING: { label: 'Preparing',  cls: 'bg-warning/10 text-warning' },
    READY:      { label: 'Ready',      cls: 'bg-success/10 text-success' },
    DOWNLOADED: { label: 'Downloaded', cls: 'bg-success/10 text-success' },
    FAILED:     { label: 'Failed',     cls: 'bg-destructive/10 text-destructive' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function DataExportPanel({ initial }: { initial: ExportRequest[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requests = [...initial].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  );
  const hasActive = requests.some((r) => r.status === 'PENDING' || r.status === 'PROCESSING');

  function handleRequest() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await requestExportAction();
      if (!res.ok) { setError(res.error); return; }
      setNotice('Your export has started. We’ll prepare a downloadable archive of your data — refresh to check progress.');
      router.refresh();
    });
  }

  function handleRefresh() {
    setError(null);
    startTransition(() => router.refresh());
  }

  async function handleDownload(id: string) {
    setError(null);
    setNotice(null);
    setDownloadingId(id);
    const res = await getDownloadUrlAction(id);
    setDownloadingId(null);
    if (!res.ok) { setError(res.error); return; }
    window.open(res.url, '_blank', 'noopener,noreferrer');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gold/30 bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-primary">Download your data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Get a machine-readable copy of your profile, matches, messages, and account activity.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRequest}
            disabled={pending || hasActive}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileArchive className="h-4 w-4" aria-hidden="true" />}
            {hasActive ? 'Export in progress' : 'Request my data'}
          </button>
        </div>

        {notice && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </p>
        )}
        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gold/30 bg-surface p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary">Your export requests</h3>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-teal transition hover:bg-teal/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>

        {requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No export requests yet. Request one above to get started.
          </p>
        ) : (
          <ul className="divide-y divide-gold/20">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-sm text-foreground">{formatDate(r.requestedAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.status === 'FAILED'
                      ? 'We couldn’t prepare this export. Please try again.'
                      : r.status === 'READY' || r.status === 'DOWNLOADED'
                        ? `Ready to download${formatBytes(r.fileSizeBytes) ? ` · ${formatBytes(r.fileSizeBytes)}` : ''}${r.downloadExpiresAt ? ` · link expires ${formatDate(r.downloadExpiresAt)}` : ''}`
                        : 'Preparing your archive…'}
                  </p>
                </div>
                {(r.status === 'READY' || r.status === 'DOWNLOADED') && (
                  <button
                    type="button"
                    onClick={() => handleDownload(r.id)}
                    disabled={downloadingId === r.id}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-teal/40 px-4 text-sm font-semibold text-teal transition hover:bg-teal/10 disabled:opacity-60"
                  >
                    {downloadingId === r.id
                      ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      : <Download className="h-4 w-4" aria-hidden="true" />}
                    Download
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
